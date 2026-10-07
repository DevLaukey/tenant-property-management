'use client';

import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  Loader2,
  Smartphone,
  XCircle,
  Clock,
  LifeBuoy,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { Plan, getPlanPrice } from '@/lib/billing/plans';
import { computeNextPeriod } from '@/lib/billing/access';
import { formatKenyanPhone, normalizeKenyanPhone } from '@/lib/billing/phone';
import {
  checkPaymentStatus,
  initiateCardPayment,
  initiateMpesaPayment,
} from '@/lib/actions/billing';
import { BillingCycle } from '@/types';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 150_000;

type Tab = 'mpesa' | 'card';
type Stage = 'form' | 'waiting' | 'success' | 'failed' | 'timeout';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: Plan;
  cycle: BillingCycle;
  /** Current paid period end, used to explain when the new period starts */
  currentPeriodEnd?: string | null;
  defaultPhone?: string | null;
  providers: { mpesa: boolean; card: boolean };
  onSuccess: () => void;
}

export function CheckoutModal({
  isOpen,
  onClose,
  plan,
  cycle,
  currentPeriodEnd,
  defaultPhone,
  providers,
  onSuccess,
}: CheckoutModalProps) {
  const initialTab: Tab = providers.mpesa ? 'mpesa' : 'card';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [phone, setPhone] = useState(() => formatKenyanPhone(defaultPhone));
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<Stage>('form');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [resultDesc, setResultDesc] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string>('');
  const submittingRef = useRef(false);

  const amount = getPlanPrice(plan, cycle);
  const nextPeriod = computeNextPeriod(currentPeriodEnd, cycle);
  const isExtension = nextPeriod.start.getTime() > Date.now() + 60_000;

  // Poll payment status while waiting for the customer to confirm on their phone.
  useEffect(() => {
    if (!isOpen || stage !== 'waiting' || !transactionId) return;

    let cancelled = false;
    let inFlight = false;
    const startedAt = Date.now();

    const tick = async () => {
      if (cancelled || inFlight) return;
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        cancelled = true;
        clearInterval(timer);
        setStage('timeout');
        return;
      }
      inFlight = true;
      try {
        const result = await checkPaymentStatus(transactionId);
        if (cancelled) return;
        if (result.status === 'success') {
          cancelled = true;
          clearInterval(timer);
          setStage('success');
        } else if (result.status === 'failed' || result.status === 'cancelled') {
          cancelled = true;
          clearInterval(timer);
          setResultDesc(
            result.resultDesc ??
              (result.status === 'cancelled'
                ? 'The payment request was cancelled.'
                : 'The payment could not be completed.')
          );
          setStage('failed');
        }
        // 'pending' or a transient error: keep polling until timeout.
      } catch {
        // Network blip: keep polling.
      } finally {
        inFlight = false;
      }
    };

    const timer = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isOpen, stage, transactionId]);

  const resetToForm = useCallback(() => {
    setStage('form');
    setTransactionId(null);
    setResultDesc(null);
    setFormError(null);
  }, []);

  const handleMpesaSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    const normalized = normalizeKenyanPhone(phone);
    if (!normalized) {
      setPhoneError('Enter a valid Safaricom number, e.g. 0712 345 678');
      return;
    }
    setPhoneError(null);
    setFormError(null);
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await initiateMpesaPayment({ planId: plan.id, cycle, phone: normalized });
      if (result.error || !result.transactionId) {
        setFormError(result.error ?? 'Could not start the M-Pesa payment. Please try again.');
        return;
      }
      setSentTo(formatKenyanPhone(normalized));
      setTransactionId(result.transactionId);
      setResultDesc(null);
      setStage('waiting');
    } catch {
      setFormError('Could not start the M-Pesa payment. Check your connection and try again.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleCardSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await initiateCardPayment({ planId: plan.id, cycle });
      if (result.error || !result.authorizationUrl) {
        setFormError(result.error ?? 'Could not start the card payment. Please try again.');
        submittingRef.current = false;
        setSubmitting(false);
        return;
      }
      // Keep the button in its loading state while the browser navigates away.
      window.location.href = result.authorizationUrl;
    } catch {
      setFormError('Could not start the card payment. Check your connection and try again.');
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const noProviders = !providers.mpesa && !providers.card;
  const showTabs = providers.mpesa && providers.card;

  const summary = (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">Plan</p>
          <p className="font-semibold text-gray-900">
            {plan.name} · {cycle === 'annual' ? 'Annual' : 'Monthly'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(amount)}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        {isExtension
          ? `Added to your current period — new end date ${formatDate(nextPeriod.end, 'long')}.`
          : `Your plan starts today and runs until ${formatDate(nextPeriod.end, 'long')}.`}{' '}
        No automatic charges — you renew manually.
      </p>
    </div>
  );

  let body: ReactNode;

  if (stage === 'waiting') {
    body = (
      <div className="flex flex-col items-center py-6 text-center" aria-live="polite" role="status">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Check your phone</h3>
        <p className="mt-2 max-w-sm text-sm text-gray-600">
          Enter your M-Pesa PIN on the prompt sent to <span className="font-medium">{sentTo}</span> to
          pay {formatCurrency(amount)}.
        </p>
        <p className="mt-4 text-xs text-gray-400">
          Waiting for confirmation… this page updates automatically.
        </p>
      </div>
    );
  } else if (stage === 'success') {
    body = (
      <div className="flex flex-col items-center py-6 text-center" aria-live="polite" role="status">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-9 w-9 text-green-600" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Payment received</h3>
        <p className="mt-2 max-w-sm text-sm text-gray-600">
          Thank you! Your {plan.name} plan is active until {formatDate(nextPeriod.end, 'long')}.
        </p>
        <Button variant="success" className="mt-6 min-w-32" onClick={onSuccess}>
          Done
        </Button>
      </div>
    );
  } else if (stage === 'failed' || stage === 'timeout') {
    body = (
      <div className="flex flex-col items-center py-6 text-center" aria-live="assertive" role="alert">
        <div
          className={cn(
            'mb-4 flex h-16 w-16 items-center justify-center rounded-full',
            stage === 'failed' ? 'bg-red-100' : 'bg-amber-100'
          )}
        >
          {stage === 'failed' ? (
            <XCircle className="h-9 w-9 text-red-600" aria-hidden="true" />
          ) : (
            <Clock className="h-9 w-9 text-amber-600" aria-hidden="true" />
          )}
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          {stage === 'failed' ? 'Payment not completed' : 'We did not get a confirmation'}
        </h3>
        <p className="mt-2 max-w-sm text-sm text-gray-600">
          {stage === 'failed'
            ? resultDesc
            : 'The M-Pesa prompt may have expired. If money left your account, it will reflect in your payment history shortly — otherwise try again.'}
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={resetToForm}>Try again</Button>
        </div>
      </div>
    );
  } else if (noProviders) {
    body = (
      <div className="space-y-4">
        {summary}
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>
            Online payments are not available right now. Please contact support to renew your
            subscription.
          </p>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="space-y-5">
        {summary}

        {showTabs && (
          <div role="tablist" aria-label="Payment method" className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              role="tab"
              id="checkout-tab-mpesa"
              aria-selected={tab === 'mpesa'}
              aria-controls="checkout-panel"
              onClick={() => {
                setTab('mpesa');
                setFormError(null);
              }}
              className={cn(
                'flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                tab === 'mpesa' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Smartphone className="h-4 w-4" aria-hidden="true" />
              M-Pesa
            </button>
            <button
              type="button"
              role="tab"
              id="checkout-tab-card"
              aria-selected={tab === 'card'}
              aria-controls="checkout-panel"
              onClick={() => {
                setTab('card');
                setFormError(null);
              }}
              className={cn(
                'flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                tab === 'card' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              Card
            </button>
          </div>
        )}

        <div
          id="checkout-panel"
          role={showTabs ? 'tabpanel' : undefined}
          aria-labelledby={showTabs ? `checkout-tab-${tab}` : undefined}
        >
          {tab === 'mpesa' ? (
            <form onSubmit={handleMpesaSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="mpesa-phone" className="mb-1.5 block text-sm font-medium text-gray-700">
                  M-Pesa phone number
                </label>
                <Input
                  id="mpesa-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0712 345 678"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (phoneError) setPhoneError(null);
                  }}
                  aria-invalid={!!phoneError}
                  aria-describedby={phoneError ? 'mpesa-phone-error' : 'mpesa-phone-help'}
                  disabled={submitting}
                />
                {phoneError ? (
                  <p id="mpesa-phone-error" className="mt-1.5 text-sm text-red-600">
                    {phoneError}
                  </p>
                ) : (
                  <p id="mpesa-phone-help" className="mt-1.5 text-xs text-gray-500">
                    You&apos;ll get a prompt on this phone to enter your M-Pesa PIN.
                  </p>
                )}
              </div>
              {formError && (
                <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {formError}
                </p>
              )}
              <Button type="submit" variant="success" className="w-full" isLoading={submitting}>
                Pay {formatCurrency(amount)} with M-Pesa
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                You&apos;ll be redirected to Paystack&apos;s secure page to pay with Visa or
                Mastercard, then brought back here.
              </p>
              {formError && (
                <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {formError}
                </p>
              )}
              <Button type="button" className="w-full" isLoading={submitting} onClick={handleCardSubmit}>
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                Pay {formatCurrency(amount)} by card
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={stage === 'form' ? `Pay for ${plan.name}` : `${plan.name} plan`}
      description={stage === 'form' ? 'Secure payment in Kenyan Shillings' : formatCurrency(amount)}
      size="md"
    >
      {body}
    </Modal>
  );
}
