'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Building2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { resendVerification } from '@/lib/actions/auth';

const COOLDOWN_SECONDS = 60;

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}

function VerifyEmail() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') ?? '';

  const [email, setEmail] = useState(emailParam);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Start with a cooldown: an email was just sent at signup.
  const [cooldown, setCooldown] = useState(emailParam ? COOLDOWN_SECONDS : 0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    setError(null);
    setNotice(null);
    setIsLoading(true);
    const result = await resendVerification(email);
    setIsLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setNotice('A new verification email is on its way.');
    setCooldown(COOLDOWN_SECONDS);
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
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
              <MailCheck className="h-7 w-7 text-blue-600" />
            </div>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              {emailParam ? (
                <>
                  We sent a verification link to <strong className="text-gray-900">{emailParam}</strong>.
                  Click it to activate your account and continue setting up.
                </>
              ) : (
                'We sent you a verification link. Click it to activate your account and continue setting up.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {notice && (
              <div className="p-3 rounded-md bg-green-50 text-green-700 text-sm">{notice}</div>
            )}
            {error && <div className="p-3 rounded-md bg-red-50 text-red-600 text-sm">{error}</div>}

            {!emailParam && (
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}

            <p className="text-sm text-gray-600 text-center">
              Didn&apos;t get it? Check your spam or promotions folder, or resend the email.
            </p>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleResend}
              isLoading={isLoading}
              disabled={cooldown > 0 || !email}
            >
              {cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend verification email'}
            </Button>

            <Link
              href="/login"
              className="flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
