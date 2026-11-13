import 'server-only';
import { createSign } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Equity Bank rent collection via Finserve Jenga API v3.
 *
 * Tenants pay with account reference CODE#UNIT (e.g. VIV#A1). Credits reach
 * the app two ways, and both go through recordEquityCredit():
 *   1. Jenga IPN webhook  -> /api/payments/equity/ipn   (real time)
 *   2. Account statement  -> /api/payments/equity/sync  (backstop, polled)
 */

const SANDBOX_URL = 'https://uat.finserve.africa';
const PRODUCTION_URL = 'https://api.finserve.africa';

function baseUrl(): string {
  return process.env.JENGA_ENV === 'production' ? PRODUCTION_URL : SANDBOX_URL;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Equity is not configured: ${name} is missing`);
  return value;
}

export function isEquityStatementConfigured(): boolean {
  return Boolean(
    process.env.JENGA_API_KEY &&
      process.env.JENGA_MERCHANT_CODE &&
      process.env.JENGA_CONSUMER_SECRET &&
      process.env.JENGA_PRIVATE_KEY &&
      process.env.EQUITY_ACCOUNT_NUMBER
  );
}

// -----------------------------------------------------
// Account reference parsing: "VIV#A1" -> { code: 'VIV', unit: 'A1' }
// -----------------------------------------------------

const REFERENCE_PATTERN = /([A-Za-z0-9]{2,10})\s*#\s*([A-Za-z0-9][A-Za-z0-9-]{0,11})/;

export interface ParsedReference {
  accountReference: string;
  paymentCode: string;
  unitCode: string;
}

export function parseAccountReference(value: unknown): ParsedReference | null {
  if (typeof value !== 'string') return null;
  const m = value.match(REFERENCE_PATTERN);
  if (!m) return null;
  return {
    accountReference: `${m[1].toUpperCase()}#${m[2].toUpperCase()}`,
    paymentCode: m[1].toUpperCase(),
    unitCode: m[2].toUpperCase(),
  };
}

/** First field (in priority order) that contains a CODE#UNIT reference. */
export function findAccountReference(candidates: unknown[]): ParsedReference | null {
  for (const c of candidates) {
    const parsed = parseAccountReference(c);
    if (parsed) return parsed;
  }
  return null;
}

// -----------------------------------------------------
// Recording a credit
// -----------------------------------------------------

export interface EquityCredit {
  bankReference: string;
  altReference?: string | null;
  reference: ParsedReference | null;
  amount: number;
  paidAt: string | null;
  payerName?: string | null;
  payerPhone?: string | null;
  narration?: string | null;
  source: 'ipn' | 'statement';
  raw: unknown;
}

export type RecordOutcome = 'matched' | 'unmatched' | 'duplicate';

export async function recordEquityCredit(credit: EquityCredit): Promise<RecordOutcome> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('record_bank_payment', {
    p_provider: 'equity',
    p_bank_reference: credit.bankReference,
    p_alt_reference: credit.altReference || null,
    p_account_reference: credit.reference?.accountReference ?? null,
    p_payment_code: credit.reference?.paymentCode ?? null,
    p_unit_code: credit.reference?.unitCode ?? null,
    p_amount: credit.amount,
    p_paid_at: credit.paidAt,
    p_payer_name: credit.payerName || null,
    p_payer_phone: credit.payerPhone || null,
    p_narration: credit.narration ? credit.narration.slice(0, 500) : null,
    p_source: credit.source,
    p_raw: credit.raw ?? null,
  });

  if (error) throw new Error(`record_bank_payment failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return (row?.outcome as RecordOutcome) ?? 'unmatched';
}

// -----------------------------------------------------
// Jenga auth + request signing
// -----------------------------------------------------

let cachedToken: { token: string; expiresAt: number; env: string } | null = null;

async function getAccessToken(): Promise<string> {
  const env = baseUrl();
  if (cachedToken && cachedToken.env === env && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const res = await fetch(`${env}/authentication/api/v3/authenticate/merchant`, {
    method: 'POST',
    headers: { 'Api-Key': requireEnv('JENGA_API_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchantCode: requireEnv('JENGA_MERCHANT_CODE'),
      consumerSecret: requireEnv('JENGA_CONSUMER_SECRET'),
    }),
    cache: 'no-store',
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Equity authentication failed (${res.status}): ${text.slice(0, 200)}`);
  }

  let body: { accessToken?: string; expiresIn?: string };
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error('Equity authentication returned an invalid response');
  }
  if (!body.accessToken) throw new Error('Equity authentication returned no access token');

  // expiresIn is a timestamp; fall back to a short cache if it can't be parsed.
  const parsedExpiry = body.expiresIn ? Date.parse(body.expiresIn) : NaN;
  const expiresAt = Number.isFinite(parsedExpiry) ? parsedExpiry - 60_000 : Date.now() + 10 * 60_000;

  cachedToken = { token: body.accessToken, expiresAt, env };
  return cachedToken.token;
}

/** RSA-SHA256 signature over the concatenated fields, as Jenga requires. */
function sign(data: string): string {
  // Env vars usually hold the PEM with literal "\n" sequences.
  const privateKey = requireEnv('JENGA_PRIVATE_KEY').replace(/\\n/g, '\n');
  return createSign('RSA-SHA256').update(data).sign(privateKey, 'base64');
}

// -----------------------------------------------------
// Account statement
// -----------------------------------------------------

export interface StatementTransaction {
  reference: string;
  description: string;
  amount: number;
  type: string;
  date: string | null;
}

function toDateString(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export async function fetchStatement(days: number): Promise<StatementTransaction[]> {
  const accountNumber = requireEnv('EQUITY_ACCOUNT_NUMBER');
  const countryCode = process.env.EQUITY_COUNTRY_CODE || 'KE';
  const now = new Date();
  const toDate = toDateString(now);
  const fromDate = toDateString(new Date(now.getTime() - days * 86_400_000));

  const token = await getAccessToken();
  const res = await fetch(`${baseUrl()}/v3-apis/account-api/v3.0/accounts/fullstatement`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      signature: sign(`${accountNumber}${countryCode}${toDate}`),
    },
    body: JSON.stringify({ countryCode, accountNumber, fromDate, toDate, limit: 500 }),
    cache: 'no-store',
  });

  const text = await res.text();
  if (res.status === 401 || res.status === 403) cachedToken = null;
  if (!res.ok) {
    throw new Error(`Equity statement request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  let body: { data?: { transactions?: unknown[] } };
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error('Equity statement returned an invalid response');
  }

  const rows = Array.isArray(body.data?.transactions) ? body.data!.transactions! : [];
  return rows.map((r) => {
    const t = r as Record<string, unknown>;
    return {
      reference: String(t.reference ?? t.serial ?? ''),
      description: String(t.description ?? t.narration ?? ''),
      amount: Math.abs(Number(t.amount ?? 0)),
      type: String(t.type ?? ''),
      date: (t.postedDateTime as string) ?? (t.date as string) ?? null,
    };
  });
}

function isCredit(type: string): boolean {
  const t = type.toLowerCase();
  return t === 'credit' || t === 'c' || t === 'cr';
}

export interface SyncSummary {
  scanned: number;
  matched: number;
  unmatched: number;
  duplicate: number;
  errors: number;
}

/** Read recent statement credits and record any not seen before. */
export async function syncEquityStatement(days = 3): Promise<SyncSummary> {
  const transactions = await fetchStatement(days);
  const summary: SyncSummary = { scanned: 0, matched: 0, unmatched: 0, duplicate: 0, errors: 0 };

  for (const tx of transactions) {
    if (!isCredit(tx.type) || !tx.reference || !(tx.amount > 0)) continue;
    summary.scanned++;

    const paidAt = tx.date && !Number.isNaN(Date.parse(tx.date)) ? new Date(tx.date).toISOString() : null;
    try {
      const outcome = await recordEquityCredit({
        bankReference: tx.reference,
        reference: findAccountReference([tx.description]),
        amount: tx.amount,
        paidAt,
        narration: tx.description,
        source: 'statement',
        raw: tx,
      });
      summary[outcome]++;
    } catch (err) {
      summary.errors++;
      console.error(`[equity sync] ${tx.reference}:`, err);
    }
  }

  return summary;
}
