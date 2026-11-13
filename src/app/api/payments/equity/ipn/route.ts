import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { findAccountReference, recordEquityCredit } from '@/lib/payments/equity';

export const dynamic = 'force-dynamic';

/**
 * Jenga IPN (Instant Payment Notification) for the Equity rent account.
 * Register this URL in Jenga HQ as:
 *   ${NEXT_PUBLIC_SITE_URL}/api/payments/equity/ipn?token=${EQUITY_IPN_SECRET}
 */

interface JengaIpn {
  callbackType?: string;
  customer?: { name?: string; mobileNumber?: string; reference?: string };
  transaction?: {
    date?: string;
    reference?: string;
    paymentMode?: string;
    amount?: number | string;
    billNumber?: string;
    additionalInfo?: string;
    status?: string;
    remarks?: string;
  };
  bank?: { reference?: string; transactionType?: string; account?: string };
}

function tokenMatches(provided: string | null): boolean {
  const expected = process.env.EQUITY_IPN_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseDate(value: string | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function POST(request: NextRequest) {
  if (!tokenMatches(request.nextUrl.searchParams.get('token'))) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 });
  }

  let payload: JengaIpn;
  try {
    payload = await request.json();
  } catch {
    console.error('[equity ipn] invalid JSON body');
    return NextResponse.json({ status: 'invalid body' }, { status: 400 });
  }

  const tx = payload.transaction ?? {};
  const bank = payload.bank ?? {};
  const customer = payload.customer ?? {};

  // Only credits that succeeded
  const type = (bank.transactionType ?? '').toUpperCase();
  const status = (tx.status ?? 'SUCCESS').toUpperCase();
  if ((type && type !== 'C' && type !== 'CREDIT') || status !== 'SUCCESS') {
    return NextResponse.json({ status: 'ignored' });
  }

  const bankReference = bank.reference || tx.reference;
  const amount = Number(tx.amount);
  if (!bankReference || !(amount > 0)) {
    console.error('[equity ipn] missing reference or amount', payload);
    return NextResponse.json({ status: 'ignored' });
  }

  // The CODE#UNIT reference can appear in different fields depending on how
  // the tenant paid (paybill 247247, Equitel, branch deposit), so check them all.
  const reference = findAccountReference([
    customer.reference,
    tx.billNumber,
    tx.additionalInfo,
    tx.remarks,
    tx.reference,
  ]);

  try {
    const outcome = await recordEquityCredit({
      bankReference,
      altReference: tx.reference && tx.reference !== bankReference ? tx.reference : null,
      reference,
      amount,
      paidAt: parseDate(tx.date),
      payerName: customer.name,
      payerPhone: customer.mobileNumber,
      narration: [tx.paymentMode, tx.billNumber, tx.additionalInfo, tx.remarks].filter(Boolean).join(' | '),
      source: 'ipn',
      raw: payload,
    });
    console.log(`[equity ipn] ${bankReference} ${reference?.accountReference ?? '(no ref)'}: ${outcome}`);
  } catch (err) {
    console.error('[equity ipn] processing error:', err);
    // Non-2xx so Jenga retries; the reference makes retries safe.
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }

  return NextResponse.json({ status: 'received' });
}
