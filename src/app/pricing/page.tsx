import type { Metadata } from 'next';
import { PricingTable } from '@/components/marketing/pricing-table';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { createClient } from '@/lib/supabase/server';
import { TRIAL_DAYS } from '@/lib/billing/plans';

export const metadata: Metadata = {
  title: 'Pricing - PropManage',
  description: 'Simple KES pricing for Kenyan landlords and property managers. Pay with M-Pesa or card.',
};

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader isLoggedIn={!!user} />
      <main className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Simple pricing in Kenyan Shillings
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Start with a {TRIAL_DAYS}-day free trial. No payment required. Pay with M-Pesa or card when you&apos;re
            ready.
          </p>
        </div>
        <div className="mt-12">
          <PricingTable isLoggedIn={!!user} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
