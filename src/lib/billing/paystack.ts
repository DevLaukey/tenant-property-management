import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';

const PAYSTACK_API = 'https://api.paystack.co';

export function isPaystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY && process.env.NEXT_PUBLIC_SITE_URL);
}

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('Paystack is not configured: PAYSTACK_SECRET_KEY is missing');
  return key;
}

interface PaystackEnvelope<T> {
  status: boolean;
  message: string;
  data?: T;
}

async function paystackRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${PAYSTACK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });

  let body: PaystackEnvelope<T>;
  try {
    body = (await res.json()) as PaystackEnvelope<T>;
  } catch {
    throw new Error(`Paystack returned an invalid response (${res.status})`);
  }

  if (!res.ok || !body.status || body.data === undefined) {
    throw new Error(`Paystack request failed: ${body.message || `HTTP ${res.status}`}`);
  }
  return body.data;
}

export interface InitializeTransactionInput {
  email: string;
  amountKes: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

export interface InitializeTransactionResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export async function initializeTransaction(input: InitializeTransactionInput): Promise<InitializeTransactionResult> {
  const data = await paystackRequest<{ authorization_url: string; access_code: string; reference: string }>(
    '/transaction/initialize',
    {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        amount: Math.round(input.amountKes * 100), // subunits
        currency: 'KES',
        reference: input.reference,
        callback_url: input.callbackUrl,
        channels: ['card', 'mobile_money'],
        metadata: input.metadata ?? {},
      }),
    }
  );
  return { authorizationUrl: data.authorization_url, accessCode: data.access_code, reference: data.reference };
}

export interface VerifiedTransaction {
  id: number;
  reference: string;
  /** 'success' | 'failed' | 'abandoned' | 'ongoing' | 'pending' | 'reversed' ... */
  status: string;
  /** Amount in subunits */
  amount: number;
  /** Amount converted to KES */
  amountKes: number;
  currency: string;
  paidAt: string | null;
  gatewayResponse: string | null;
  raw: Record<string, unknown>;
}

export async function verifyTransaction(reference: string): Promise<VerifiedTransaction> {
  const data = await paystackRequest<Record<string, unknown>>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: 'GET' }
  );
  const amount = Number(data.amount ?? 0);
  return {
    id: Number(data.id),
    reference: String(data.reference ?? reference),
    status: String(data.status ?? ''),
    amount,
    amountKes: amount / 100,
    currency: String(data.currency ?? ''),
    paidAt: (data.paid_at as string) ?? (data.paidAt as string) ?? null,
    gatewayResponse: (data.gateway_response as string) ?? null,
    raw: data,
  };
}

/** Validate the x-paystack-signature header (HMAC SHA512 of the raw body). */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null | undefined): boolean {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !signatureHeader) return false;

  const expected = createHmac('sha512', key).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signatureHeader.trim().toLowerCase(), 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
