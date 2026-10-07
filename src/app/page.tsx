import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  FileText,
  Smartphone,
  Users,
  Wrench,
} from 'lucide-react';
import { PricingTable } from '@/components/marketing/pricing-table';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { createClient } from '@/lib/supabase/server';
import { TRIAL_DAYS } from '@/lib/billing/plans';

export const metadata: Metadata = {
  title: 'PropManage - Property management for Kenyan landlords',
  description:
    'Manage properties, units, tenants, leases, rent and maintenance in one place. Built for Kenya, billed via M-Pesa.',
};

const FEATURES = [
  {
    icon: Building2,
    title: 'Properties & units',
    description: 'Keep every building, flat and shop in one place, with occupancy at a glance.',
  },
  {
    icon: Users,
    title: 'Tenants & leases',
    description: 'Tenant records, lease terms, deposits and renewal dates — no more paper files.',
  },
  {
    icon: Smartphone,
    title: 'Rent tracking with M-Pesa',
    description: 'Record rent payments, see who is overdue and share M-Pesa paybill instructions with tenants.',
  },
  {
    icon: Wrench,
    title: 'Maintenance',
    description: 'Tenants log repair requests; you track priority and progress until they are fixed.',
  },
];

const FAQS = [
  {
    q: 'How does the free trial work?',
    a: `Every new landlord or property manager account gets ${TRIAL_DAYS} days of full access. No M-Pesa payment or card is needed to start. When the trial ends, pick a plan to keep going — your data stays safe.`,
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. There are no contracts. If you cancel, you keep access until the end of the period you have already paid for.',
  },
  {
    q: 'How does M-Pesa billing work?',
    a: 'Billing is prepaid. Each time your plan renews you receive an M-Pesa STK push on your phone — just enter your PIN to pay. Nothing is deducted automatically without your approval.',
  },
  {
    q: 'Can I pay by card instead?',
    a: 'Yes. You can pay with a debit or credit card as an alternative to M-Pesa.',
  },
  {
    q: 'Do my tenants need to pay for an account?',
    a: 'No. Tenant accounts are always free. Only landlords and property managers subscribe.',
  },
  {
    q: 'Can I change plans later?',
    a: 'Yes. Upgrade or downgrade at any time from your billing page as your portfolio grows.',
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader isLoggedIn={isLoggedIn} />

      <main>
        {/* Hero */}
        <section className="bg-gradient-to-br from-blue-50 to-gray-100">
          <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-700 shadow-sm sm:text-sm">
              <Smartphone className="h-4 w-4" />
              Pay with M-Pesa · {TRIAL_DAYS}-day free trial
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Property management for <span className="text-blue-600">Kenyan landlords</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
              Track properties, tenants, leases, rent and repairs in one simple dashboard. Stop chasing rent in
              notebooks and WhatsApp threads.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 font-semibold text-white hover:bg-blue-700 sm:w-auto"
                >
                  Go to dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 font-semibold text-white hover:bg-blue-700 sm:w-auto"
                  >
                    Start free trial
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="#pricing"
                    className="inline-flex h-12 w-full items-center justify-center rounded-lg border-2 border-gray-300 bg-white px-6 font-semibold text-gray-900 hover:bg-gray-50 sm:w-auto"
                  >
                    See pricing
                  </Link>
                </>
              )}
            </div>
            <ul className="mt-6 flex flex-col items-center justify-center gap-2 text-sm text-gray-600 sm:flex-row sm:gap-6">
              {['No payment required to start', 'Set up in minutes', 'Cancel anytime'].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Everything you need to run your rentals</h2>
            <p className="mt-4 text-gray-600">
              Built for how property works in Kenya — from a single block of bedsitters to a full agency portfolio.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50">
                  <Icon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="mt-4 font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm text-gray-600">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-16 bg-gray-50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900">Simple pricing in KES</h2>
              <p className="mt-4 text-gray-600">
                Try any plan free for {TRIAL_DAYS} days. Pay with M-Pesa or card when you&apos;re ready.
              </p>
            </div>
            <div className="mt-12">
              <PricingTable isLoggedIn={isLoggedIn} />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">Frequently asked questions</h2>
          <div className="mt-10 divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
            {FAQS.map(({ q, a }) => (
              <details key={q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-gray-900">
                  {q}
                  <ChevronDown className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm text-gray-600">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        {!isLoggedIn && (
          <section className="bg-blue-600">
            <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-14 text-center">
              <FileText className="h-10 w-10 text-blue-200" />
              <h2 className="text-2xl font-bold text-white sm:text-3xl">Ready to get organised?</h2>
              <p className="max-w-xl text-blue-100">
                Create your account in under a minute. {TRIAL_DAYS} days free, no payment required.
              </p>
              <Link
                href="/signup"
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-white px-6 font-semibold text-blue-700 hover:bg-blue-50"
              >
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
