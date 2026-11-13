import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { markTransactionFailed, markTransactionSuccess } from '@/lib/billing/fulfill';

export const dynamic = 'force-dynamic';

const ACCEPTED = { ResultCode: 0, ResultDesc: 'Accepted' };

type CallbackItem = { Name: string; Value?: string | number };

interface StkCallback {
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResultCode?: number | string;
  ResultDesc?: string;
  CallbackMetadata?: { Item?: CallbackItem[] };
}

function tokenMatches(provided: string | null): boolean {
  const expected = process.env.MPESA_CALLBACK_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** M-Pesa TransactionDate 20240115143012 (Nairobi time) -> ISO string */
function parseMpesaDate(value: string | number | undefined): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value);
  if (!/^\d{14}$/.test(s)) return null;
  const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}+03:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function POST(request: NextRequest) {
  if (!tokenMatches(request.nextUrl.searchParams.get('token'))) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: 'Unauthorized' }, { status: 401 });
  }

  let payload: { Body?: { stkCallback?: StkCallback } };
  try {
    payload = await request.json();
  } catch {
    console.error('[mpesa callback] invalid JSON body');
    return NextResponse.json(ACCEPTED);
  }

  const cb = payload?.Body?.stkCallback;
  if (!cb?.CheckoutRequestID) {
    console.error('[mpesa callback] missing stkCallback.CheckoutRequestID', payload);
    return NextResponse.json(ACCEPTED);
  }

  try {
    const resultCode = String(cb.ResultCode ?? '');
    if (resultCode === '0') {
      const items = cb.CallbackMetadata?.Item ?? [];
      const get = (name: string) => items.find((i) => i.Name === name)?.Value;
      const amount = get('Amount');

      const outcome = await markTransactionSuccess(cb.CheckoutRequestID, {
        receiptNumber: get('MpesaReceiptNumber') != null ? String(get('MpesaReceiptNumber')) : null,
        paidAt: parseMpesaDate(get('TransactionDate')),
        amountPaid: amount != null ? Number(amount) : null,
        raw: payload,
      });
      console.log(`[mpesa callback] ${cb.CheckoutRequestID}: ${outcome}`);
    } else {
      const outcome = await markTransactionFailed(cb.CheckoutRequestID, {
        resultCode,
        resultDesc: cb.ResultDesc ?? null,
        raw: payload,
      });
      console.log(`[mpesa callback] ${cb.CheckoutRequestID}: ${outcome} (code ${resultCode})`);
    }
  } catch (err) {
    console.error('[mpesa callback] processing error:', err);
  }

  return NextResponse.json(ACCEPTED);
}
