import { NextResponse, type NextRequest } from 'next/server';
import { verifyTransaction } from '@/lib/billing/paystack';
import { markTransactionFailed, markTransactionSuccess } from '@/lib/billing/fulfill';

export const dynamic = 'force-dynamic';

/** Browser redirect target after Paystack hosted checkout (?reference=...). */
export async function GET(request: NextRequest) {
  const reference =
    request.nextUrl.searchParams.get('reference') || request.nextUrl.searchParams.get('trxref');

  const redirect = (result: 'success' | 'failed') => {
    const url = request.nextUrl.clone();
    url.pathname = '/billing';
    url.search = `?payment=${result}`;
    return NextResponse.redirect(url);
  };

  if (!reference) return redirect('failed');

  try {
    const verified = await verifyTransaction(reference);

    if (verified.status === 'success' && verified.currency === 'KES') {
      const outcome = await markTransactionSuccess(reference, {
        receiptNumber: String(verified.id),
        paidAt: verified.paidAt,
        amountPaid: verified.amountKes,
        raw: verified.raw,
      });
      return redirect(outcome === 'success' || outcome === 'already_success' ? 'success' : 'failed');
    }

    if (['failed', 'abandoned', 'reversed'].includes(verified.status)) {
      await markTransactionFailed(reference, {
        resultCode: verified.status,
        resultDesc: verified.gatewayResponse ?? `Payment ${verified.status}`,
        raw: verified.raw,
        status: verified.status === 'abandoned' ? 'cancelled' : 'failed',
      });
    }
    // 'ongoing' / 'pending' etc.: leave the tx pending — the webhook will settle it.
    return redirect('failed');
  } catch (err) {
    console.error(`[paystack callback] ${reference}: verification error`, err);
    return redirect('failed');
  }
}
