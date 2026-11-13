import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Building2, CalendarClock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OnboardingForm } from '@/components/onboarding/onboarding-form';
import { StepIndicator } from '@/components/onboarding/step-indicator';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/lib/actions/auth';
import { getSubscriptionAccess } from '@/lib/billing/access';
import { formatKenyanPhone } from '@/lib/billing/phone';
import { getPlan, TRIAL_DAYS } from '@/lib/billing/plans';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Set up your account - PropManage',
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, phone, role, organization_name, onboarding_completed')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('subscriptions')
      .select('status, plan_id, trial_ends_at, current_period_end')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const meta = user.user_metadata ?? {};
  const role = profile?.role ?? meta.role;

  if (role === 'tenant' || profile?.onboarding_completed) {
    redirect('/dashboard');
  }

  const access = getSubscriptionAccess(subscription);
  const trialDays = access.status === 'trialing' ? access.daysRemaining : null;
  const selectedPlan = getPlan(meta.selected_plan);

  const fullName: string = profile?.full_name || meta.full_name || '';
  const firstName = fullName.split(' ')[0];
  const phone: string = profile?.phone || meta.phone || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">PropManage</span>
        </div>
        <form action={signOut}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-900">
            Sign out
          </button>
        </form>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-16">
        <div className="mb-8">
          <StepIndicator currentStep={2} />
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Welcome{firstName ? `, ${firstName}` : ''}! Let&apos;s set up your business
          </h1>
          <p className="mt-2 text-gray-600">
            A few details so we can personalise your account and bill you via M-Pesa when you&apos;re
            ready.
          </p>
        </div>

        <div className="mb-6 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
              <CalendarClock className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-sm">
              {trialDays !== null ? (
                <>
                  <p className="font-semibold text-gray-900">
                    Your free trial is active — {trialDays} {trialDays === 1 ? 'day' : 'days'} remaining
                  </p>
                  <p className="mt-0.5 text-gray-600">
                    Full access to {access.plan?.name ?? 'all'} features until{' '}
                    {access.accessEndsAt ? formatDate(access.accessEndsAt, 'long') : 'the end of your trial'}. No
                    payment needed now — choose a plan whenever you&apos;re ready.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-gray-900">{TRIAL_DAYS}-day free trial</p>
                  <p className="mt-0.5 text-gray-600">
                    Every new account gets {TRIAL_DAYS} days of full access. No payment needed to get started.
                  </p>
                </>
              )}
              {selectedPlan && (
                <p className="mt-2 flex items-center gap-1.5 text-blue-700">
                  <CheckCircle2 className="h-4 w-4" />
                  You picked the {selectedPlan.name} plan — you can confirm it on the next step.
                </p>
              )}
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Business details</CardTitle>
            <CardDescription>You can update these anytime from your settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardingForm
              defaultFullName={fullName}
              defaultOrganizationName={profile?.organization_name || meta.organization_name || ''}
              defaultPhone={phone ? formatKenyanPhone(phone) : ''}
              isPropertyManager={role === 'property_manager'}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
