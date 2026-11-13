'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSubscriptionSummary } from '@/lib/actions/billing';

type Summary = NonNullable<Awaited<ReturnType<typeof getSubscriptionSummary>>['data']>;

type Tone = 'blue' | 'amber' | 'red';

const toneClasses: Record<Tone, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  amber: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100',
  red: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
};

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function describe(summary: Summary): { tone: Tone; label: string; Icon: typeof Clock } | null {
  const days = summary.daysRemaining ?? 0;

  switch (summary.status) {
    case 'trialing':
      return {
        tone: days <= 3 ? 'amber' : 'blue',
        label: `Trial · ${plural(days, 'day')} left`,
        Icon: Sparkles,
      };
    case 'active':
      if (days > 7) return null;
      return summary.cancelAtPeriodEnd
        ? { tone: 'amber', label: `Ends in ${plural(days, 'day')}`, Icon: Clock }
        : { tone: 'amber', label: `Renews in ${plural(days, 'day')}`, Icon: Clock };
    case 'cancelled':
      if (days > 7) return null;
      return { tone: 'amber', label: `Ends in ${plural(days, 'day')}`, Icon: Clock };
    case 'past_due':
      return { tone: 'red', label: `Grace period · ${plural(days, 'day')}`, Icon: AlertTriangle };
    case 'expired':
      return { tone: 'red', label: 'Subscription expired', Icon: AlertTriangle };
    default:
      return null;
  }
}

export function SubscriptionBanner() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let active = true;
    getSubscriptionSummary()
      .then((result) => {
        if (active && result.data) setSummary(result.data);
      })
      .catch(() => {
        // Non-critical UI; ignore failures.
      });
    return () => {
      active = false;
    };
  }, []);

  if (!summary) return null;
  const info = describe(summary);
  if (!info) return null;

  const { tone, label, Icon } = info;

  return (
    <Link
      href="/billing"
      title={label}
      aria-label={`${label}. Go to billing`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium transition-colors sm:px-3',
        toneClasses[tone]
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline whitespace-nowrap">{label}</span>
    </Link>
  );
}
