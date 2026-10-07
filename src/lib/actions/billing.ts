'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createClient, getUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSubscriptionAccess, type SubscriptionAccess } from '@/lib/billing/access';
import { getPlan, getPlanPrice, isPlanId } from '@/lib/billing/plans';
import { getUsage, type Usage } from '@/lib/billing/limits';
import { normalizeKenyanPhone } from '@/lib/billing/phone';
import { isMpesaConfigured, stkPush, stkQuery } from '@/lib/billing/mpesa';
import { initializeTransaction, isPaystackConfigured, verifyTransaction } from '@/lib/billing/paystack';
import { markTransactionFailed, markTransactionSuccess } from '@/lib/billing/fulfill';
import type {
  BillingCycle,
  BillingTransaction,
  BillingTransactionStatus,
  Subscription,
  SubscriptionStatus,
  UserRole,
} from '@/types';

// =====================================================
// Types
// =====================================================

export type BillingOverview = {
  subscription: Subscription | null;
  access: SubscriptionAccess;
  usage: Usage;
  /** latest 20, newest first */
  transactions: BillingTransaction[];
  profile: { email: string; full_name: string; phone: string | null; role: UserRole };
  /** which payment providers are configured */
  providers: { mpesa: boolean; card: boolean };
};

export type SubscriptionSummary = {
  status: SubscriptionStatus;
  hasAccess: boolean;
  planName: string | null;
  daysRemaining: number | null;
  accessEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
};

// =====================================================
// Helpers
// =====================================================

const PAYING_ROLES: UserRole[] = ['owner', 'property_manager'];
/** Ask Daraja for the status once the callback is this late */
const STK_QUERY_AFTER_MS = 15_000;
/** Give up on an unanswered STK push after this long */
const STK_TIMEOUT_MS = 3 * 60_000;
/** Don't allow a new STK push while one this recent is still pending */
const STK_RESEND_GUARD_MS = 20_000;
const TEMP_REFERENCE_PREFIX = 'pending_';

function isCycle(value: unknown): value is BillingCycle {
  return value === 'monthly' || value === 'annual';
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

async function requirePayer() {
  const { user, profile } = await getUser();
  if (!user) return { error: 'Not authenticated' as const };
  if (!profile || !PAYING_ROLES.includes(profile.role as UserRole)) {
    return { error: 'Only property owners and managers can manage a subscription' as const };
  }
  return { user, profile };
}

function validatePlan(planId: string, cycle: BillingCycle) {
  if (!isPlanId(planId)) return { error: 'Choose a valid plan' };
  if (!isCycle(cycle)) return { error: 'Choose a valid billing cycle' };
  const plan = getPlan(planId)!;
  return { plan, amount: getPlanPrice(plan, cycle) };
}

// =====================================================
// Queries
// =====================================================

export async function getBillingOverview(): Promise<{ error?: string; data?: BillingOverview }> {
  try {
    const { user, profile } = await getUser();
    if (!user || !profile) return { error: 'Not authenticated' };

    const supabase = await createClient();

    const [{ data: subscription, error: subError }, { data: transactions, error: txError }, usage] =
      await Promise.all([
        supabase.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('billing_transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        getUsage(user.id),
      ]);

    if (subError) return { error: subError.message };
    if (txError) return { error: txError.message };

    const sub = (subscription as Subscription | null) ?? null;

    return {
      data: {
        subscription: sub,
        access: getSubscriptionAccess(sub),
        usage,
        transactions: (transactions as BillingTransaction[]) ?? [],
        profile: {
          email: profile.email ?? user.email ?? '',
          full_name: profile.full_name ?? '',
          phone: profile.phone || null,
          role: profile.role as UserRole,
        },
        providers: { mpesa: isMpesaConfigured(), card: isPaystackConfigured() },
      },
    };
  } catch (err) {
    console.error('[billing] getBillingOverview failed:', err);
    return { error: 'Could not load billing information' };
  }
}

export async function getSubscriptionSummary(): Promise<{ error?: string; data?: SubscriptionSummary | null }> {
  try {
    const { user, profile } = await getUser();
    if (!user) return { error: 'Not authenticated' };
    if (!profile || profile.role === 'tenant') return { data: null };

    const supabase = await createClient();
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) return { error: error.message };
    if (!subscription) return { data: null };

    const sub = subscription as Subscription;
    const access = getSubscriptionAccess(sub);
    return {
      data: {
        status: access.status,
        hasAccess: access.hasAccess,
        planName: access.plan?.name ?? null,
        daysRemaining: access.daysRemaining,
        accessEndsAt: access.accessEndsAt ? access.accessEndsAt.toISOString() : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    };
  } catch (err) {
    console.error('[billing] getSubscriptionSummary failed:', err);
    return { error: 'Could not load subscription' };
  }
}

// =====================================================
// M-Pesa STK Push
// =====================================================

export async function initiateMpesaPayment(input: {
  planId: string;
  cycle: BillingCycle;
  phone: string;
}): Promise<{ error?: string; transactionId?: string; message?: string }> {
  try {
    const payer = await requirePayer();
    if ('error' in payer) return { error: payer.error };
    const { user, profile } = payer;

    if (!isMpesaConfigured()) {
      return { error: 'M-Pesa payments are not available right now. Please try card payment or contact support.' };
    }

    const validated = validatePlan(input?.planId, input?.cycle);
    if ('error' in validated) return { error: validated.error };
    const { plan, amount } = validated;

    const phone = normalizeKenyanPhone(input?.phone);
    if (!phone) return { error: 'Enter a valid Safaricom number, e.g. 0712 345 678' };

    const admin = createAdminClient();

    // Prevent accidental double-taps from sending two prompts.
    const { data: recent } = await admin
      .from('billing_transactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'mpesa')
      .eq('status', 'pending')
      .gte('created_at', new Date(Date.now() - STK_RESEND_GUARD_MS).toISOString())
      .limit(1);
    if (recent && recent.length > 0) {
      return { error: 'A payment request was just sent to your phone. Please wait a few seconds before trying again.' };
    }

    const { data: sub } = await admin.from('subscriptions').select('id').eq('user_id', user.id).maybeSingle();

    const { data: tx, error: insertError } = await admin
      .from('billing_transactions')
      .insert({
        user_id: user.id,
        subscription_id: sub?.id ?? null,
        plan_id: plan.id,
        billing_cycle: input.cycle,
        amount,
        currency: 'KES',
        provider: 'mpesa',
        status: 'pending',
        phone,
        provider_reference: `${TEMP_REFERENCE_PREFIX}${randomUUID()}`,
      })
      .select('id')
      .single();

    if (insertError || !tx) {
      console.error('[billing] failed to create mpesa transaction:', insertError);
      return { error: 'Could not start the payment. Please try again.' };
    }

    if (!profile.phone) {
      await admin.from('profiles').update({ phone }).eq('id', user.id);
    }

    try {
      const result = await stkPush({
        phone,
        amount,
        accountReference: `PM-${String(tx.id).slice(0, 8)}`,
        description: `${plan.name} plan`,
      });

      const { error: updateError } = await admin
        .from('billing_transactions')
        .update({
          provider_reference: result.checkoutRequestId,
          merchant_request_id: result.merchantRequestId,
        })
        .eq('id', tx.id);

      if (updateError) {
        // The prompt went out but we can't match the callback — surface it loudly.
        console.error(`[billing] failed to store CheckoutRequestID for tx ${tx.id}:`, updateError);
      }

      revalidatePath('/billing');
      return {
        transactionId: tx.id as string,
        message: 'Check your phone and enter your M-Pesa PIN to complete the payment.',
      };
    } catch (err) {
      const message = errorMessage(err, 'M-Pesa request failed');
      console.error(`[billing] stkPush failed for tx ${tx.id}:`, err);
      await admin
        .from('billing_transactions')
        .update({ status: 'failed', result_desc: message.slice(0, 500) })
        .eq('id', tx.id)
        .eq('status', 'pending');
      revalidatePath('/billing');
      return { error: 'We could not send the M-Pesa prompt. Check the number and try again.' };
    }
  } catch (err) {
    console.error('[billing] initiateMpesaPayment failed:', err);
    return { error: 'Could not start the payment. Please try again.' };
  }
}

export async function checkPaymentStatus(
  transactionId: string
): Promise<{ error?: string; status?: BillingTransactionStatus; resultDesc?: string | null }> {
  try {
    const { user } = await getUser();
    if (!user) return { error: 'Not authenticated' };
    if (!transactionId || typeof transactionId !== 'string') return { error: 'Invalid transaction' };

    const supabase = await createClient();
    const load = async () => {
      const { data } = await supabase
        .from('billing_transactions')
        .select('*')
        .eq('id', transactionId)
        .eq('user_id', user.id)
        .maybeSingle();
      return data as BillingTransaction | null;
    };

    let tx = await load();
    if (!tx) return { error: 'Transaction not found' };

    if (tx.status !== 'pending' || !tx.provider_reference || tx.provider_reference.startsWith(TEMP_REFERENCE_PREFIX)) {
      return { status: tx.status, resultDesc: tx.result_desc ?? null };
    }

    const age = Date.now() - new Date(tx.created_at).getTime();
    const reference = tx.provider_reference;
    let changed = false;

    if (tx.provider === 'mpesa' && age > STK_QUERY_AFTER_MS && isMpesaConfigured()) {
      try {
        const q = await stkQuery(reference);
        if (q.resultCode === '0') {
          // STK Query does not return the receipt; the callback (if it arrives) is a no-op then.
          await markTransactionSuccess(reference, { receiptNumber: null, raw: { source: 'stk_query', ...q } });
          changed = true;
        } else if (q.resultCode !== null) {
          await markTransactionFailed(reference, {
            resultCode: q.resultCode,
            resultDesc: q.resultDesc,
            raw: { source: 'stk_query', ...q },
          });
          changed = true;
        }
      } catch (err) {
        console.error(`[billing] stkQuery failed for ${reference}:`, err);
      }

      if (!changed && age > STK_TIMEOUT_MS) {
        await markTransactionFailed(reference, {
          resultCode: null,
          resultDesc: 'Payment timed out',
          raw: { source: 'timeout' },
        });
        changed = true;
      }
    } else if (tx.provider === 'paystack' && age > STK_QUERY_AFTER_MS && isPaystackConfigured()) {
      try {
        const verified = await verifyTransaction(reference);
        if (verified.status === 'success' && verified.currency === 'KES') {
          await markTransactionSuccess(reference, {
            receiptNumber: String(verified.id),
            paidAt: verified.paidAt,
            amountPaid: verified.amountKes,
            raw: verified.raw,
          });
          changed = true;
        }
      } catch (err) {
        console.error(`[billing] paystack verify failed for ${reference}:`, err);
      }
    }

    if (changed) {
      revalidatePath('/billing');
      tx = (await load()) ?? tx;
    }
    return { status: tx.status, resultDesc: tx.result_desc ?? null };
  } catch (err) {
    console.error('[billing] checkPaymentStatus failed:', err);
    return { error: 'Could not check the payment status' };
  }
}

// =====================================================
// Paystack (card / mobile money)
// =====================================================

export async function initiateCardPayment(input: {
  planId: string;
  cycle: BillingCycle;
}): Promise<{ error?: string; authorizationUrl?: string }> {
  try {
    const payer = await requirePayer();
    if ('error' in payer) return { error: payer.error };
    const { user, profile } = payer;

    if (!isPaystackConfigured()) {
      return { error: 'Card payments are not available right now. Please pay with M-Pesa or contact support.' };
    }

    const validated = validatePlan(input?.planId, input?.cycle);
    if ('error' in validated) return { error: validated.error };
    const { plan, amount } = validated;

    const email = profile.email || user.email;
    if (!email) return { error: 'Add an email address to your profile to pay by card' };

    const admin = createAdminClient();
    const { data: sub } = await admin.from('subscriptions').select('id').eq('user_id', user.id).maybeSingle();
    const reference = `sub_${randomUUID()}`;

    const { data: tx, error: insertError } = await admin
      .from('billing_transactions')
      .insert({
        user_id: user.id,
        subscription_id: sub?.id ?? null,
        plan_id: plan.id,
        billing_cycle: input.cycle,
        amount,
        currency: 'KES',
        provider: 'paystack',
        status: 'pending',
        provider_reference: reference,
      })
      .select('id')
      .single();

    if (insertError || !tx) {
      console.error('[billing] failed to create paystack transaction:', insertError);
      return { error: 'Could not start the payment. Please try again.' };
    }

    try {
      const result = await initializeTransaction({
        email,
        amountKes: amount,
        reference,
        callbackUrl: `${siteUrl()}/api/billing/paystack/callback`,
        metadata: {
          transaction_id: tx.id,
          user_id: user.id,
          plan_id: plan.id,
          billing_cycle: input.cycle,
        },
      });
      revalidatePath('/billing');
      return { authorizationUrl: result.authorizationUrl };
    } catch (err) {
      const message = errorMessage(err, 'Paystack request failed');
      console.error(`[billing] paystack initialize failed for tx ${tx.id}:`, err);
      await admin
        .from('billing_transactions')
        .update({ status: 'failed', result_desc: message.slice(0, 500) })
        .eq('id', tx.id)
        .eq('status', 'pending');
      revalidatePath('/billing');
      return { error: 'Could not start the card payment. Please try again.' };
    }
  } catch (err) {
    console.error('[billing] initiateCardPayment failed:', err);
    return { error: 'Could not start the payment. Please try again.' };
  }
}

// =====================================================
// Cancel / resume
// =====================================================

async function setCancelAtPeriodEnd(value: boolean): Promise<{ error?: string; success?: boolean }> {
  try {
    const payer = await requirePayer();
    if ('error' in payer) return { error: payer.error };
    const { user } = payer;

    const admin = createAdminClient();
    const { data: sub, error: loadError } = await admin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (loadError) return { error: loadError.message };
    if (!sub) return { error: 'You do not have a subscription' };

    const access = getSubscriptionAccess(sub as Subscription);
    if (!sub.current_period_end || !access.hasAccess || access.status === 'trialing') {
      return {
        error: value
          ? 'You do not have an active paid subscription to cancel'
          : 'You do not have an active paid subscription to resume',
      };
    }

    // Status stays 'active'; access simply isn't renewed after the period ends
    // (payments are prepaid, there is no auto-charge).
    const { error } = await admin
      .from('subscriptions')
      .update({ cancel_at_period_end: value })
      .eq('id', sub.id);
    if (error) return { error: error.message };

    revalidatePath('/billing');
    return { success: true };
  } catch (err) {
    console.error('[billing] setCancelAtPeriodEnd failed:', err);
    return { error: 'Could not update your subscription' };
  }
}

export async function cancelSubscription(): Promise<{ error?: string; success?: boolean }> {
  return setCancelAtPeriodEnd(true);
}

export async function resumeSubscription(): Promise<{ error?: string; success?: boolean }> {
  return setCancelAtPeriodEnd(false);
}
