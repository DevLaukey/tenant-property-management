'use client';

import { ReactNode, Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Check,
  CreditCard,
  Home,
  Info,
  Receipt,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckoutModal } from '@/components/billing/checkout-modal';
import { cn, formatCurrency } from '@/lib/utils';
import { PLANS, Plan, getPlan, getPlanPrice, GRACE_PERIOD_DAYS } from '@/lib/billing/plans';
import {
  getBillingOverview,
  cancelSubscription,
  resumeSubscription,
} from '@/lib/actions/billing';
import { BillingCycle, BillingTransaction } from '@/types';

type Overview = NonNullable<Awaited<ReturnType<typeof getBillingOverview>>['data']>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(value: unknown): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

const planRank = (id: string | null | undefined) => PLANS.findIndex((p) => p.id === id);

const txStatus: Record<
  BillingTransaction['status'],
  { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }
> = {
  success: { label: 'Paid', variant: 'success' },
  pending: { label: 'Pending', variant: 'warning' },
  failed: { label: 'Failed', variant: 'danger' },
  cancelled: { label: 'Cancelled', variant: 'default' },
};

/** Why a plan cannot hold the user's current data, or null if it fits. */
function planDoesNotFit(plan: Plan, usage: Overview['usage']): string | null {
  const reasons: string[] = [];
  if (plan.maxProperties !== null && usage.properties > plan.maxProperties) {
    reasons.push(`${usage.properties} ${usage.properties === 1 ? 'property' : 'properties'} (limit ${plan.maxProperties})`);
  }
  if (plan.maxUnits !== null && usage.units > plan.maxUnits) {
    reasons.push(`${plural(usage.units, 'unit')} (limit ${plan.maxUnits})`);
  }
  if (reasons.length === 0) return null;
  return `You currently have ${reasons.join(' and ')}. Archive some before switching to ${plan.name}.`;
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function Notice({
  tone,
  icon,
  children,
}: {
  tone: 'red' | 'blue' | 'green' | 'amber';
  icon: ReactNode;
  children: ReactNode;
}) {
  const tones = {
    red: 'border-red-200 bg-red-50 text-red-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    green: 'border-green-200 bg-green-50 text-green-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
  };
  return (
    <div
      role={tone === 'red' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-xl border p-4 text-sm', tones[tone])}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>{children}</div>
    </div>
  );
}

function UsageBar({
  label,
  icon,
  used,
  limit,
}: {
  label: string;
  icon: ReactNode;
  used: number;
  limit: number | null | undefined;
}) {
  const unlimited = limit === null;
  const unknown = limit === undefined;
  const pct = unlimited || unknown || !limit ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-blue-600';

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-medium text-gray-700">
          <span className="text-gray-400">{icon}</span>
          {label}
        </span>
        <span className="text-gray-600">
          <span className="font-semibold text-gray-900">{used}</span>
          {' / '}
          {unlimited ? 'Unlimited' : unknown ? '—' : limit}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-label={`${label} used`}
        aria-valuemin={0}
        aria-valuemax={unlimited || unknown ? undefined : (limit ?? undefined)}
        aria-valuenow={used}
        aria-valuetext={unlimited ? `${used} of unlimited` : unknown ? `${used}` : `${used} of ${limit}`}
      >
        <div
          className={cn('h-full rounded-full transition-all', unlimited ? 'bg-green-500' : barColor)}
          style={{ width: unlimited ? '100%' : `${pct}%`, opacity: unlimited ? 0.35 : 1 }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BillingPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<BillingSkeleton />}>
        <BillingContent />
      </Suspense>
    </DashboardLayout>
  );
}

function BillingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="h-9 w-48 animate-pulse rounded-lg bg-gray-200" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-56 animate-pulse rounded-xl bg-gray-100 lg:col-span-2" />
        <div className="h-56 animate-pulse rounded-xl bg-gray-100" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-80 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    </div>
  );
}

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const expiredParam = searchParams.get('expired') === '1';
  const welcomeParam = searchParams.get('welcome') === '1';
  const paymentParam = searchParams.get('payment');

  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [cycleTouched, setCycleTouched] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const [confirmAction, setConfirmAction] = useState<'cancel' | 'resume' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState(false);

  const fetchOverview = useCallback(async () => {
    try {
      const result = await getBillingOverview();
      if (result.error || !result.data) {
        setLoadError(result.error ?? 'Could not load billing details.');
      } else {
        setOverview(result.data);
        setLoadError(null);
      }
    } catch {
      setLoadError('Could not load billing details. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Default the toggle to the user's current billing cycle once loaded.
  useEffect(() => {
    if (!cycleTouched && overview?.subscription?.current_period_end && overview.subscription.billing_cycle) {
      setCycle(overview.subscription.billing_cycle);
    }
  }, [overview, cycleTouched]);

  const handlePaymentSuccess = async () => {
    setCheckoutPlan(null);
    setJustPaid(true);
    await fetchOverview();
    router.refresh();
  };

  const handleConfirmAction = async () => {
    if (!confirmAction || actionLoading) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const result =
        confirmAction === 'cancel' ? await cancelSubscription() : await resumeSubscription();
      if (result.error) {
        setActionError(result.error);
        return;
      }
      setConfirmAction(null);
      await fetchOverview();
      router.refresh();
    } catch {
      setActionError('Something went wrong. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) return <BillingSkeleton />;

  if (!overview) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Billing</h1>
        <Notice tone="red" icon={<XCircle className="h-5 w-5" />}>
          <p>{loadError ?? 'Could not load billing details.'}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => {
              setIsLoading(true);
              fetchOverview();
            }}
          >
            Retry
          </Button>
        </Notice>
      </div>
    );
  }

  const { subscription, access, usage, transactions, profile, providers } = overview;

  if (profile.role === 'tenant') {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Billing</h1>
        <Card className="p-6 text-sm text-gray-600">
          Subscriptions are managed by your landlord or property manager. There is nothing for you
          to pay here.
        </Card>
      </div>
    );
  }

  const status = access.status;
  const accessEndsAt = toDate(access.accessEndsAt);
  const periodEnd = toDate(subscription?.current_period_end);
  const hasPaidPeriod = !!periodEnd;
  const cancelAtPeriodEnd = !!subscription?.cancel_at_period_end || status === 'cancelled';
  const currentPlan = access.plan;
  const paidPlanId = hasPaidPeriod ? subscription?.plan_id : null;
  const days = access.daysRemaining;

  // Status badge
  let badge: { label: string; variant: 'success' | 'warning' | 'danger' | 'default' | 'primary' };
  if (status === 'trialing') badge = { label: 'Trial', variant: 'primary' };
  else if (status === 'past_due') badge = { label: 'Grace period', variant: 'danger' };
  else if (status === 'expired') badge = { label: 'Expired', variant: 'danger' };
  else if (cancelAtPeriodEnd) badge = { label: `Cancels on ${fmtDate(periodEnd ?? accessEndsAt)}`, variant: 'warning' };
  else badge = { label: 'Active', variant: 'success' };

  const amount =
    hasPaidPeriod && currentPlan && subscription
      ? getPlanPrice(currentPlan, subscription.billing_cycle)
      : null;

  const canCancel = hasPaidPeriod && status === 'active' && !cancelAtPeriodEnd;
  const canResume = hasPaidPeriod && access.hasAccess && cancelAtPeriodEnd && status !== 'past_due';

  const showExpired = expiredParam || (!access.hasAccess && status === 'expired');
  const wasTrial = !hasPaidPeriod;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Billing</h1>
        <p className="mt-1 text-gray-600">Manage your plan, payments and receipts</p>
      </div>

      {/* Banners */}
      <div className="space-y-3 empty:hidden">
        {showExpired && (
          <Notice tone="red" icon={<AlertTriangle className="h-5 w-5" />}>
            <p className="font-medium">
              Your {wasTrial ? 'trial' : 'subscription'} has ended. Choose a plan to regain access to
              your dashboard.
            </p>
          </Notice>
        )}
        {welcomeParam && status === 'trialing' && (
          <Notice tone="blue" icon={<Sparkles className="h-5 w-5" />}>
            <p className="font-medium">Welcome aboard!</p>
            <p className="mt-0.5">
              You&apos;re on a 14-day free trial of Growth. Pick a plan now or anytime before it
              ends.
            </p>
          </Notice>
        )}
        {(paymentParam === 'success' || justPaid) && (
          <Notice tone="green" icon={<CheckCircle2 className="h-5 w-5" />}>
            <p className="font-medium">Payment received — thank you!</p>
            <p className="mt-0.5">Your subscription has been updated. A receipt is listed below.</p>
          </Notice>
        )}
        {paymentParam === 'failed' && !justPaid && (
          <Notice tone="red" icon={<XCircle className="h-5 w-5" />}>
            <p className="font-medium">Your payment was not completed.</p>
            <p className="mt-0.5">No money was taken. You can try again with M-Pesa or a card.</p>
          </Notice>
        )}
        {status === 'past_due' && (
          <Notice tone="amber" icon={<AlertTriangle className="h-5 w-5" />}>
            <p className="font-medium">
              Your period ended — renew within {plural(days ?? 0, 'day')} to avoid losing access.
            </p>
          </Notice>
        )}
      </div>

      {/* Current subscription + usage */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Current plan</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  {currentPlan?.name ?? 'No plan'}
                </h2>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </div>
              {currentPlan && <p className="mt-1 text-sm text-gray-500">{currentPlan.description}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {canCancel && (
                <Button variant="outline" size="sm" onClick={() => setConfirmAction('cancel')}>
                  Cancel at period end
                </Button>
              )}
              {canResume && (
                <Button size="sm" onClick={() => setConfirmAction('resume')}>
                  Resume subscription
                </Button>
              )}
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">
                {status === 'trialing'
                  ? 'Trial ends'
                  : status === 'past_due'
                    ? 'Access ends'
                    : status === 'expired'
                      ? 'Ended'
                      : cancelAtPeriodEnd
                        ? 'Ends on'
                        : 'Renews on'}
              </dt>
              <dd className="mt-1 font-semibold text-gray-900">
                {fmtDate(status === 'active' || status === 'cancelled' ? (periodEnd ?? accessEndsAt) : accessEndsAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">Days remaining</dt>
              <dd
                className={cn(
                  'mt-1 font-semibold',
                  days !== null && days <= 3 ? 'text-red-600' : days !== null && days <= 7 ? 'text-amber-600' : 'text-gray-900'
                )}
              >
                {days === null ? '—' : days}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">Billing cycle</dt>
              <dd className="mt-1 font-semibold text-gray-900">
                {hasPaidPeriod && subscription
                  ? subscription.billing_cycle === 'annual'
                    ? 'Annual'
                    : 'Monthly'
                  : status === 'trialing'
                    ? 'Free trial'
                    : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">Amount</dt>
              <dd className="mt-1 font-semibold text-gray-900">
                {amount !== null ? formatCurrency(amount) : status === 'trialing' ? 'Free' : '—'}
              </dd>
            </div>
          </dl>

          {status === 'past_due' && (
            <p className="mt-4 text-sm text-red-700">
              Your plan is in its {GRACE_PERIOD_DAYS}-day grace period. Renew below to keep
              uninterrupted access — the new period continues from today.
            </p>
          )}
          {status === 'trialing' && (
            <p className="mt-4 text-sm text-gray-600">
              Your trial includes everything in Growth. Choose a plan below to keep going after it
              ends — payments add to any remaining time.
            </p>
          )}
          {cancelAtPeriodEnd && access.hasAccess && status !== 'past_due' && (
            <p className="mt-4 text-sm text-gray-600">
              Your subscription won&apos;t be renewed. You keep full access until{' '}
              {fmtDate(periodEnd ?? accessEndsAt)}.
            </p>
          )}
          {hasPaidPeriod && !cancelAtPeriodEnd && status === 'active' && (
            <p className="mt-4 text-sm text-gray-600">
              We&apos;ll remind you before your renewal date. Renewals are manual — pay by M-Pesa or card
              whenever you&apos;re ready.
            </p>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-gray-900">Usage</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {currentPlan ? `Limits on your ${currentPlan.name} plan` : 'No active plan'}
          </p>
          <div className="mt-5 space-y-5">
            <UsageBar
              label="Properties"
              icon={<Building2 className="h-4 w-4" />}
              used={usage.properties}
              limit={currentPlan ? currentPlan.maxProperties : undefined}
            />
            <UsageBar
              label="Units"
              icon={<Home className="h-4 w-4" />}
              used={usage.units}
              limit={currentPlan ? currentPlan.maxUnits : undefined}
            />
          </div>
        </Card>
      </div>

      {/* Plan picker */}
      <section aria-labelledby="plans-heading" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="plans-heading" className="text-xl font-semibold text-gray-900">
              {hasPaidPeriod ? 'Change or renew your plan' : 'Choose a plan'}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Prices in Kenyan Shillings. Pay with M-Pesa or card.
            </p>
          </div>
          <div
            role="radiogroup"
            aria-label="Billing cycle"
            className="inline-flex self-start rounded-lg bg-gray-100 p-1 sm:self-auto"
          >
            {(['monthly', 'annual'] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={cycle === c}
                onClick={() => {
                  setCycle(c);
                  setCycleTouched(true);
                }}
                className={cn(
                  'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  cycle === c ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {c === 'monthly' ? 'Monthly' : 'Annual'}
                {c === 'annual' && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                    2 months free
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const price = getPlanPrice(plan, cycle);
            const isPaidCurrent = paidPlanId === plan.id;
            const isTrialPlan = status === 'trialing' && currentPlan?.id === plan.id;
            const misfit = planDoesNotFit(plan, usage);

            let label = 'Choose plan';
            let variant: 'primary' | 'outline' | 'success' = plan.highlighted ? 'primary' : 'outline';
            if (paidPlanId) {
              const diff = planRank(plan.id) - planRank(paidPlanId);
              if (diff === 0) {
                label = 'Renew';
                variant = 'primary';
              } else if (diff > 0) {
                label = 'Upgrade';
                variant = 'primary';
              } else {
                label = 'Downgrade';
                variant = 'outline';
              }
            }

            return (
              <Card
                key={plan.id}
                className={cn(
                  'relative flex flex-col p-6',
                  isPaidCurrent || isTrialPlan
                    ? 'border-2 border-blue-600'
                    : plan.highlighted
                      ? 'border-blue-200'
                      : ''
                )}
              >
                {(isPaidCurrent || isTrialPlan) && (
                  <span className="absolute -top-3 left-6 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white">
                    {isTrialPlan ? 'Your trial plan' : 'Current plan'}
                  </span>
                )}
                {!isPaidCurrent && !isTrialPlan && plan.highlighted && (
                  <span className="absolute -top-3 left-6 rounded-full bg-gray-900 px-3 py-0.5 text-xs font-semibold text-white">
                    Most popular
                  </span>
                )}

                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-gray-500">{plan.description}</p>

                <div className="mt-4">
                  <span className="text-3xl font-bold text-gray-900">{formatCurrency(price)}</span>
                  <span className="text-sm text-gray-500"> / {cycle === 'annual' ? 'year' : 'month'}</span>
                  {cycle === 'annual' && (
                    <p className="mt-1 text-xs text-green-700">
                      Save {formatCurrency(plan.priceMonthly * 12 - plan.priceAnnual)} a year
                    </p>
                  )}
                </div>

                <ul className="mt-5 flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  <Button
                    className="w-full"
                    variant={variant}
                    disabled={!!misfit}
                    aria-describedby={misfit ? `misfit-${plan.id}` : undefined}
                    onClick={() => setCheckoutPlan(plan)}
                  >
                    {label}
                  </Button>
                  {misfit && (
                    <p id={`misfit-${plan.id}`} className="mt-2 flex items-start gap-1.5 text-xs text-gray-500">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {misfit}
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Payment history */}
      <section aria-labelledby="history-heading" className="space-y-4">
        <h2 id="history-heading" className="text-xl font-semibold text-gray-900">
          Payment history
        </h2>
        {transactions.length > 0 ? (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const st = txStatus[tx.status] ?? { label: tx.status, variant: 'default' as const };
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap">{fmtDate(tx.paid_at ?? tx.created_at)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {getPlan(tx.plan_id)?.name ?? tx.plan_id}
                        <span className="text-gray-500"> · {tx.billing_cycle === 'annual' ? 'Annual' : 'Monthly'}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {tx.provider === 'mpesa' ? (
                            <span className="h-2 w-2 rounded-full bg-green-600" aria-hidden="true" />
                          ) : (
                            <CreditCard className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                          )}
                          {tx.provider === 'mpesa' ? 'M-Pesa' : 'Card'}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium">{formatCurrency(tx.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-gray-600">
                        {tx.receipt_number ?? '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon={<Receipt className="h-10 w-10" />}
              title="No payments yet"
              description="When you pay for a plan, your receipts will appear here."
            />
          </Card>
        )}
      </section>

      {/* Checkout */}
      {checkoutPlan && (
        <CheckoutModal
          isOpen={!!checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          plan={checkoutPlan}
          cycle={cycle}
          currentPeriodEnd={subscription?.current_period_end ?? null}
          defaultPhone={profile.phone}
          providers={providers}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Cancel / resume confirmation */}
      <Modal
        isOpen={confirmAction !== null}
        onClose={() => {
          if (actionLoading) return;
          setConfirmAction(null);
          setActionError(null);
        }}
        title={confirmAction === 'cancel' ? 'Cancel at period end?' : 'Resume subscription?'}
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              disabled={actionLoading}
              onClick={() => {
                setConfirmAction(null);
                setActionError(null);
              }}
            >
              {confirmAction === 'cancel' ? 'Keep subscription' : 'Not now'}
            </Button>
            <Button
              variant={confirmAction === 'cancel' ? 'danger' : 'primary'}
              isLoading={actionLoading}
              onClick={handleConfirmAction}
            >
              {confirmAction === 'cancel' ? 'Cancel at period end' : 'Resume'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-gray-600">
          {confirmAction === 'cancel' ? (
            <p>
              You&apos;ll keep full access to {currentPlan?.name ?? 'your plan'} until{' '}
              <span className="font-medium text-gray-900">{fmtDate(periodEnd)}</span>. After that,
              your dashboard will be locked until you pay again. Your data is kept.
            </p>
          ) : (
            <p>
              Your subscription will continue past{' '}
              <span className="font-medium text-gray-900">{fmtDate(periodEnd)}</span>. You&apos;ll be
              reminded to renew before then.
            </p>
          )}
          {actionError && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
              {actionError}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
