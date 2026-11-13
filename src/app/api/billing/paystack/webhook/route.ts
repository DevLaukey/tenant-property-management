import { NextResponse, type NextRequest } from 'next/server';
import { verifyTransaction, verifyWebhookSignature } from '@/lib/billing/paystack';
import { markTransactionSuccess } from '@/lib/billing/fulfill';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!verifyWebhookSignature(rawBody, request.headers.get('x-paystack-signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ received: true });
  }

  if (event.event === 'charge.success' && event.data?.reference) {
    const reference = event.data.reference;
    try {
      // Never trust the webhook payload alone — confirm with the API.
      const verified = await verifyTransaction(reference);
      if (verified.status === 'success' && verified.currency === 'KES') {
        const outcome = await markTransactionSuccess(reference, {
          receiptNumber: String(verified.id),
          paidAt: verified.paidAt,
          amountPaid: verified.amountKes,
          raw: verified.raw,
        });
        console.log(`[paystack webhook] ${reference}: ${outcome}`);
      } else {
        console.warn(
          `[paystack webhook] ${reference}: verify returned status=${verified.status} currency=${verified.currency}`
        );
      }
    } catch (err) {
      console.error(`[paystack webhook] ${reference}: processing error`, err);
      // 500 so Paystack retries later
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
