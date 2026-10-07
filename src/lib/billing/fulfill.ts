import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { BillingCycle, BillingTransaction, Subscription } from '@/types';
import { computeNextPeriod } from './access';

/**
 * Idempotent settlement of billing transactions. Called from payment
 * callbacks/webhooks and from status reconciliation. Uses the service-role
 * client — callers must have authenticated the request already.
 *
 * Concurrency: the transaction row is flipped with a conditional update
 * (status != 'success'), so only one caller ever wins and extends the
 * subscription. The subscription itself is updated with optimistic locking
 * on updated_at so two *different* successful payments landing at the same
 * moment don't overwrite each other's extension.
 *
 * Plan changes: a payment for a different plan still extends from the
 * existing period end (no proration) — the new plan applies immediately.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

export interface SuccessDetails {
  receiptNumber: string | null;
  paidAt?: string | Date | null;
  /** Amount actually paid in KES — if lower than the transaction amount the payment is rejected */
  amountPaid?: number | null;
  raw: unknown;
}

export interface FailureDetails {
  resultCode: string | number | null;
  resultDesc: string | null;
  raw: unknown;
  status?: 'failed' | 'cancelled';
}

export type SettlementOutcome =
  | 'success'
  | 'already_success'
  | 'amount_mismatch'
  | 'failed'
  | 'not_found'
  | 'not_pending'
  | 'error';

async function loadTransaction(admin: AdminClient, reference: string): Promise<BillingTransaction | null> {
  const { data, error } = await admin
    .from('billing_transactions')
    .select('*')
    .eq('provider_reference', reference)
    .maybeSingle();
  if (error) throw new Error(`Failed to load transaction ${reference}: ${error.message}`);
  return (data as BillingTransaction | null) ?? null;
}

function toIso(value: string | Date | null | undefined): string {
  if (!value) return new Date().toISOString();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export async function markTransactionSuccess(reference: string, details: SuccessDetails): Promise<SettlementOutcome> {
  const admin = createAdminClient();
  const tx = await loadTransaction(admin, reference);
  if (!tx) {
    console.error(`[billing] markTransactionSuccess: no transaction for reference ${reference}`);
    return 'not_found';
  }
  if (tx.status === 'success') {
    // STK Query settles without a receipt; fill it in when the callback arrives later.
    if (!tx.receipt_number && details.receiptNumber) {
      await admin
        .from('billing_transactions')
        .update({ receipt_number: details.receiptNumber, raw_callback: details.raw ?? null })
        .eq('id', tx.id)
        .is('receipt_number', null);
    }
    return 'already_success';
  }

  if (details.amountPaid != null && Number(details.amountPaid) < Number(tx.amount)) {
    await admin
      .from('billing_transactions')
      .update({
        status: 'failed',
        result_desc: 'Amount mismatch',
        receipt_number: details.receiptNumber,
        raw_callback: details.raw ?? null,
      })
      .eq('id', tx.id)
      .neq('status', 'success');
    console.error(
      `[billing] amount mismatch for ${reference}: paid ${details.amountPaid}, expected ${tx.amount}`
    );
    return 'amount_mismatch';
  }

  // Flip to success atomically. We accept a success arriving after we marked
  // the tx failed/cancelled locally (e.g. our 3-minute timeout fired before a
  // late M-Pesa callback) — the customer's money did move.
  const paidAt = toIso(details.paidAt);
  const { data: flipped, error: flipError } = await admin
    .from('billing_transactions')
    .update({
      status: 'success',
      paid_at: paidAt,
      receipt_number: details.receiptNumber,
      result_code: '0',
      result_desc: 'Success',
      raw_callback: details.raw ?? null,
    })
    .eq('id', tx.id)
    .neq('status', 'success')
    .select('id');

  if (flipError) throw new Error(`Failed to update transaction ${reference}: ${flipError.message}`);
  if (!flipped || flipped.length === 0) return 'already_success';

  const subscriptionId = await extendSubscription(admin, tx.user_id, tx.plan_id, tx.billing_cycle);

  if (subscriptionId && tx.subscription_id !== subscriptionId) {
    await admin.from('billing_transactions').update({ subscription_id: subscriptionId }).eq('id', tx.id);
  }
  return 'success';
}

async function extendSubscription(
  admin: AdminClient,
  userId: string,
  planId: string,
  cycle: BillingCycle
): Promise<string | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing, error: loadError } = await admin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (loadError) throw new Error(`Failed to load subscription for ${userId}: ${loadError.message}`);

    const sub = existing as Subscription | null;
    const { start, end } = computeNextPeriod(sub?.current_period_end ?? null, cycle);
    const values = {
      plan_id: planId,
      billing_cycle: cycle,
      status: 'active' as const,
      cancel_at_period_end: false,
      current_period_start: start.toISOString(),
      current_period_end: end.toISOString(),
    };

    if (!sub) {
      const { data: inserted, error } = await admin
        .from('subscriptions')
        .insert({ user_id: userId, ...values })
        .select('id')
        .maybeSingle();
      if (!error && inserted) return inserted.id as string;
      // unique violation — someone created it concurrently; retry as update
      if (error && error.code !== '23505') {
        throw new Error(`Failed to create subscription for ${userId}: ${error.message}`);
      }
      continue;
    }

    const { data: updated, error } = await admin
      .from('subscriptions')
      .update(values)
      .eq('id', sub.id)
      .eq('updated_at', sub.updated_at)
      .select('id');
    if (error) throw new Error(`Failed to update subscription for ${userId}: ${error.message}`);
    if (updated && updated.length > 0) return sub.id;
    // row changed underneath us — reload and retry
  }
  throw new Error(`Failed to extend subscription for ${userId}: too many concurrent updates`);
}

export async function markTransactionFailed(reference: string, details: FailureDetails): Promise<SettlementOutcome> {
  const admin = createAdminClient();
  const code = details.resultCode == null ? null : String(details.resultCode);
  const status = details.status ?? (code === '1032' ? 'cancelled' : 'failed');

  const { data, error } = await admin
    .from('billing_transactions')
    .update({
      status,
      result_code: code,
      result_desc: details.resultDesc,
      raw_callback: details.raw ?? null,
    })
    .eq('provider_reference', reference)
    .eq('status', 'pending')
    .select('id');

  if (error) throw new Error(`Failed to mark transaction ${reference} failed: ${error.message}`);
  if (!data || data.length === 0) return 'not_pending';
  return 'failed';
}
