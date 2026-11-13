import { Subscription, SubscriptionStatus } from '@/types';
import { GRACE_PERIOD_DAYS, Plan, TRIAL_PLAN_ID, getPlan } from './plans';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SubscriptionAccess {
  /** Status derived from dates, not the stored column (no cron needed) */
  status: SubscriptionStatus;
  hasAccess: boolean;
  /** Plan whose limits currently apply (trial uses TRIAL_PLAN_ID) */
  plan: Plan | undefined;
  /** When access ends (trial end, or period end + grace) */
  accessEndsAt: Date | null;
  daysRemaining: number | null;
}

type SubscriptionDates = Pick<
  Subscription,
  'status' | 'plan_id' | 'trial_ends_at' | 'current_period_end'
>;

/**
 * Pure function — safe to call from the proxy, server actions and client
 * components. A paid period always wins over a trial.
 */
export function getSubscriptionAccess(
  sub: SubscriptionDates | null | undefined,
  now: Date = new Date()
): SubscriptionAccess {
  if (!sub) {
    return { status: 'expired', hasAccess: false, plan: undefined, accessEndsAt: null, daysRemaining: null };
  }

  const remaining = (end: Date) => Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));

  if (sub.current_period_end) {
    const periodEnd = new Date(sub.current_period_end);
    const graceEnd = new Date(periodEnd.getTime() + GRACE_PERIOD_DAYS * DAY_MS);
    const plan = getPlan(sub.plan_id);

    if (sub.status === 'cancelled') {
      const ok = now < periodEnd;
      return { status: ok ? 'cancelled' : 'expired', hasAccess: ok, plan, accessEndsAt: periodEnd, daysRemaining: remaining(periodEnd) };
    }
    if (now < periodEnd) {
      return { status: 'active', hasAccess: true, plan, accessEndsAt: periodEnd, daysRemaining: remaining(periodEnd) };
    }
    if (now < graceEnd) {
      return { status: 'past_due', hasAccess: true, plan, accessEndsAt: graceEnd, daysRemaining: remaining(graceEnd) };
    }
    return { status: 'expired', hasAccess: false, plan, accessEndsAt: graceEnd, daysRemaining: 0 };
  }

  if (sub.trial_ends_at) {
    const trialEnd = new Date(sub.trial_ends_at);
    const ok = now < trialEnd;
    return {
      status: ok ? 'trialing' : 'expired',
      hasAccess: ok,
      plan: getPlan(TRIAL_PLAN_ID),
      accessEndsAt: trialEnd,
      daysRemaining: remaining(trialEnd),
    };
  }

  return { status: 'expired', hasAccess: false, plan: undefined, accessEndsAt: null, daysRemaining: null };
}

/**
 * New period after a successful payment: extends from the current period end
 * if still in the future (early renewal), otherwise starts now.
 */
export function computeNextPeriod(
  currentPeriodEnd: string | null | undefined,
  cycle: 'monthly' | 'annual',
  now: Date = new Date()
): { start: Date; end: Date } {
  const existing = currentPeriodEnd ? new Date(currentPeriodEnd) : null;
  const start = existing && existing > now ? existing : now;
  const end = new Date(start);
  if (cycle === 'annual') end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return { start, end };
}
