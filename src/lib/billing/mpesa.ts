import 'server-only';

/**
 * Safaricom Daraja (M-Pesa Express / STK Push) client.
 *
 * Daraja does not sign callbacks, so the CallBackURL carries a secret token
 * (MPESA_CALLBACK_SECRET) which the callback route checks.
 */

const SANDBOX_URL = 'https://sandbox.safaricom.co.ke';
const PRODUCTION_URL = 'https://api.safaricom.co.ke';

function baseUrl(): string {
  return process.env.MPESA_ENV === 'production' ? PRODUCTION_URL : SANDBOX_URL;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`M-Pesa is not configured: ${name} is missing`);
  return value;
}

export function isMpesaConfigured(): boolean {
  return Boolean(
    process.env.MPESA_CONSUMER_KEY &&
      process.env.MPESA_CONSUMER_SECRET &&
      process.env.MPESA_SHORTCODE &&
      process.env.MPESA_PASSKEY &&
      process.env.MPESA_CALLBACK_SECRET &&
      process.env.NEXT_PUBLIC_SITE_URL
  );
}

// -----------------------------------------------------
// OAuth token (cached in memory until shortly before expiry)
// -----------------------------------------------------

let cachedToken: { token: string; expiresAt: number; env: string } | null = null;

async function getAccessToken(): Promise<string> {
  const env = baseUrl();
  if (cachedToken && cachedToken.env === env && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const key = requireEnv('MPESA_CONSUMER_KEY');
  const secret = requireEnv('MPESA_CONSUMER_SECRET');
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');

  const res = await fetch(`${env}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: { Authorization: `Basic ${auth}` },
    cache: 'no-store',
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`M-Pesa authentication failed (${res.status}): ${text.slice(0, 200)}`);
  }

  let body: { access_token?: string; expires_in?: string | number };
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error('M-Pesa authentication returned an invalid response');
  }
  if (!body.access_token) throw new Error('M-Pesa authentication returned no access token');

  const expiresInSec = Number(body.expires_in) || 3599;
  cachedToken = {
    token: body.access_token,
    // refresh 60s early
    expiresAt: Date.now() + Math.max(0, expiresInSec - 60) * 1000,
    env,
  };
  return cachedToken.token;
}

// -----------------------------------------------------
// Helpers
// -----------------------------------------------------

/** YYYYMMDDHHmmss in Africa/Nairobi time */
function nairobiTimestamp(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}${get('month')}${get('day')}${get('hour')}${get('minute')}${get('second')}`;
}

function stkPassword(shortcode: string, passkey: string, timestamp: string): string {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

async function darajaPost(path: string, payload: unknown): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const token = await getAccessToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { errorMessage: text.slice(0, 200) };
  }
  if (res.status === 401 || res.status === 403) {
    // token may have been revoked; drop the cache so the next call re-authenticates
    cachedToken = null;
  }
  return { ok: res.ok, status: res.status, body };
}

// -----------------------------------------------------
// STK Push
// -----------------------------------------------------

export interface StkPushInput {
  /** 2547XXXXXXXX / 2541XXXXXXXX */
  phone: string;
  /** KES, will be rounded up to an integer */
  amount: number;
  accountReference: string;
  description: string;
}

export interface StkPushResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  customerMessage: string;
}

export async function stkPush(input: StkPushInput): Promise<StkPushResult> {
  const shortcode = requireEnv('MPESA_SHORTCODE');
  const passkey = requireEnv('MPESA_PASSKEY');
  const callbackSecret = requireEnv('MPESA_CALLBACK_SECRET');
  const siteUrl = requireEnv('NEXT_PUBLIC_SITE_URL').replace(/\/+$/, '');
  const transactionType = process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline';
  const partyB = process.env.MPESA_PARTY_B || shortcode;

  const amount = Math.ceil(input.amount);
  if (!Number.isFinite(amount) || amount < 1) {
    throw new Error('Invalid payment amount');
  }

  const timestamp = nairobiTimestamp();
  const payload = {
    BusinessShortCode: shortcode,
    Password: stkPassword(shortcode, passkey, timestamp),
    Timestamp: timestamp,
    TransactionType: transactionType,
    Amount: amount,
    PartyA: input.phone,
    PartyB: partyB,
    PhoneNumber: input.phone,
    CallBackURL: `${siteUrl}/api/billing/mpesa/callback?token=${encodeURIComponent(callbackSecret)}`,
    AccountReference: input.accountReference.slice(0, 12),
    TransactionDesc: input.description.slice(0, 13),
  };

  const { ok, status, body } = await darajaPost('/mpesa/stkpush/v1/processrequest', payload);

  if (!ok || String(body.ResponseCode ?? '') !== '0') {
    const message =
      (body.errorMessage as string) ||
      (body.ResponseDescription as string) ||
      (body.CustomerMessage as string) ||
      `HTTP ${status}`;
    throw new Error(`M-Pesa request failed: ${message}`);
  }

  return {
    checkoutRequestId: String(body.CheckoutRequestID),
    merchantRequestId: String(body.MerchantRequestID ?? ''),
    customerMessage: String(body.CustomerMessage ?? 'Check your phone to complete the payment'),
  };
}

// -----------------------------------------------------
// STK Query
// -----------------------------------------------------

export interface StkQueryResult {
  /** null while the transaction is still being processed */
  resultCode: string | null;
  resultDesc: string | null;
}

export async function stkQuery(checkoutRequestId: string): Promise<StkQueryResult> {
  const shortcode = requireEnv('MPESA_SHORTCODE');
  const passkey = requireEnv('MPESA_PASSKEY');
  const timestamp = nairobiTimestamp();

  const { body } = await darajaPost('/mpesa/stkpushquery/v1/query', {
    BusinessShortCode: shortcode,
    Password: stkPassword(shortcode, passkey, timestamp),
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId,
  });

  // While the customer hasn't answered, Daraja returns an error body such as
  // { errorCode: '500.001.1001', errorMessage: 'The transaction is being processed' }.
  if (body.ResultCode === undefined || body.ResultCode === null) {
    return {
      resultCode: null,
      resultDesc: (body.errorMessage as string) ?? (body.ResponseDescription as string) ?? null,
    };
  }

  return {
    resultCode: String(body.ResultCode),
    resultDesc: (body.ResultDesc as string) ?? null,
  };
}
