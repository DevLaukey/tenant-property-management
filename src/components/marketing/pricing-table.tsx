'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, CreditCard, Smartphone } from 'lucide-react';
import { PLANS, TRIAL_DAYS } from '@/lib/billing/plans';
import { BillingCycle } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';

interface PricingTableProps {
  /** Logged-in users go to /billing instead of /signup */
  isLoggedIn?: boolean;
}

export function PricingTable({ isLoggedIn = false }: PricingTableProps) {
  const [cycle, setCycle] = useState<BillingCycle>('monthly');

  return (
    <div>
      {/* Billing cycle toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 shadow-sm" role="group">
          {(['monthly', 'annual'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCycle(c)}
              aria-pressed={cycle === c}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                cycle === c ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {c === 'monthly' ? 'Monthly' : 'Annual'}
              {c === 'annual' && (
                <span
                  className={cn(
                    'ml-2 rounded-full px-2 py-0.5 text-xs',
                    cycle === 'annual' ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'
                  )}
                >
                  2 months free
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plans */}
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const annualSavings = plan.priceMonthly * 12 - plan.priceAnnual;
          const href = isLoggedIn ? `/billing?plan=${plan.id}` : `/signup?plan=${plan.id}`;

          return (
            <div
              key={plan.id}
              className={cn(
                'relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm',
                plan.highlighted ? 'border-blue-600 ring-2 ring-blue-600 md:-my-2 md:py-8' : 'border-gray-200'
              )}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                  Most popular
                </span>
              )}

              <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
              <p className="mt-1 text-sm text-gray-600">{plan.description}</p>

              <div className="mt-6">
                {cycle === 'monthly' ? (
                  <>
                    <span className="text-3xl font-bold text-gray-900">{formatCurrency(plan.priceMonthly)}</span>
                    <span className="text-sm text-gray-500"> /month</span>
                  </>
                ) : (
                  <>
                    <span className="text-3xl font-bold text-gray-900">{formatCurrency(plan.priceAnnual)}</span>
                    <span className="text-sm text-gray-500"> /year</span>
                    {annualSavings > 0 && (
                      <p className="mt-1 text-sm font-medium text-green-700">
                        Save {formatCurrency(annualSavings)} a year
                      </p>
                    )}
                  </>
                )}
              </div>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={href}
                className={cn(
                  'mt-8 inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors',
                  plan.highlighted
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'border-2 border-gray-300 text-gray-900 hover:bg-gray-50'
                )}
              >
                {isLoggedIn ? `Choose ${plan.name}` : 'Start free trial'}
              </Link>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col items-center gap-2 text-sm text-gray-600 sm:flex-row sm:justify-center sm:gap-6">
        <span className="inline-flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-green-600" />
          Pay with M-Pesa
        </span>
        <span className="inline-flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-blue-600" />
          or card
        </span>
        <span>
          {TRIAL_DAYS}-day free trial · prices in KES
        </span>
      </div>
    </div>
  );
}
