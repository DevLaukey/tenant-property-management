'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Building2, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { signUp } from '@/lib/actions/auth';
import { getPlan, TRIAL_DAYS } from '@/lib/billing/plans';
import { formatCurrency } from '@/lib/utils';

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const searchParams = useSearchParams();
  const selectedPlan = getPlan(searchParams.get('plan'));

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState('owner');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const isTenant = role === 'tenant';

  const handleSubmit = async (formData: FormData) => {
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    const result = await signUp(formData);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
              <Building2 className="h-7 w-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">PropManage</span>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create an account</CardTitle>
            <CardDescription>
              {isTenant
                ? 'Access your lease, payments and maintenance requests'
                : `Start your ${TRIAL_DAYS}-day free trial · no payment required`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isTenant && (
              <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    {selectedPlan ? (
                      <p>
                        You picked <strong>{selectedPlan.name}</strong> (
                        {formatCurrency(selectedPlan.priceMonthly)}/month). Try every feature free for{' '}
                        {TRIAL_DAYS} days — you only pay when you decide to continue.
                      </p>
                    ) : (
                      <p>
                        {TRIAL_DAYS}-day free trial with full access. No card or M-Pesa payment needed to
                        start.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <form action={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-red-50 text-red-600 text-sm">
                  {error}
                </div>
              )}

              {selectedPlan && !isTenant && (
                <input type="hidden" name="selectedPlan" value={selectedPlan.id} />
              )}

              <Input
                label="Full Name"
                name="fullName"
                type="text"
                placeholder="John Doe"
                autoComplete="name"
                required
              />

              <Input
                label="Email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />

              <Select
                label="I am a..."
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                options={[
                  { value: 'owner', label: 'Property Owner' },
                  { value: 'property_manager', label: 'Property Manager' },
                  { value: 'tenant', label: 'Tenant' },
                ]}
                required
              />

              {!isTenant && (
                <Input
                  label="Organization name"
                  name="organizationName"
                  type="text"
                  placeholder="e.g. Kamau Properties Ltd"
                  autoComplete="organization"
                  helperText="Your business or trading name. You can change it later."
                />
              )}

              <Input
                label="Phone (M-Pesa number)"
                name="phone"
                type="tel"
                inputMode="tel"
                placeholder="0712 345 678"
                autoComplete="tel"
                helperText={
                  isTenant ? 'Optional — so your landlord can reach you' : 'Used for M-Pesa subscription payments'
                }
              />

              <Input
                label="Password"
                name="password"
                type="password"
                placeholder="••••••••"
                helperText="Must be at least 8 characters"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <Input
                label="Confirm Password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />

              <Button type="submit" className="w-full" isLoading={isLoading}>
                {isTenant ? 'Create Account' : 'Start Free Trial'}
              </Button>

              {!isTenant && (
                <ul className="space-y-1 text-xs text-gray-500">
                  {['No payment required today', 'Pay with M-Pesa or card when ready', 'Cancel anytime'].map(
                    (item) => (
                      <li key={item} className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        {item}
                      </li>
                    )
                  )}
                </ul>
              )}

              <p className="text-center text-sm text-gray-600">
                Already have an account?{' '}
                <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                  Sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-500 mt-6">
          By signing up, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
