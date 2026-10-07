'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { updatePassword } from '@/lib/actions/auth';

export default function ResetPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (formData: FormData) => {
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    const result = await updatePassword(formData);

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
          <div className="flex items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
              <Building2 className="h-7 w-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">PropManage</span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Set a new password</CardTitle>
            <CardDescription>Choose a strong password you haven&apos;t used before</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-red-50 text-red-600 text-sm">
                  {error}{' '}
                  {error.includes('expired') && (
                    <Link href="/forgot-password" className="font-medium underline">
                      Request a new link
                    </Link>
                  )}
                </div>
              )}

              <Input
                label="New Password"
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
                label="Confirm New Password"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />

              <Button type="submit" className="w-full" isLoading={isLoading}>
                Update Password
              </Button>

              <Link
                href="/login"
                className="flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Link>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
