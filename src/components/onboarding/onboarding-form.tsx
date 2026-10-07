'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { completeOnboarding } from '@/lib/actions/auth';

interface OnboardingFormProps {
  defaultFullName: string;
  defaultOrganizationName: string;
  defaultPhone: string;
  isPropertyManager: boolean;
}

export function OnboardingForm({
  defaultFullName,
  defaultOrganizationName,
  defaultPhone,
  isPropertyManager,
}: OnboardingFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    setIsLoading(true);
    const result = await completeOnboarding(formData);
    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
    }
  };

  return (
    <form action={handleSubmit} className="space-y-4">
      {error && <div className="p-3 rounded-md bg-red-50 text-red-600 text-sm">{error}</div>}

      <Input
        label="Your full name"
        name="fullName"
        type="text"
        placeholder="John Doe"
        autoComplete="name"
        defaultValue={defaultFullName}
        required
      />

      <Input
        label={isPropertyManager ? 'Company name' : 'Business or portfolio name'}
        name="organizationName"
        type="text"
        placeholder={isPropertyManager ? 'e.g. Nyumba Management Ltd' : 'e.g. Kamau Properties'}
        autoComplete="organization"
        helperText="Shown on receipts and tenant communication"
        defaultValue={defaultOrganizationName}
        required
      />

      <Input
        label="Phone (M-Pesa number)"
        name="phone"
        type="tel"
        inputMode="tel"
        placeholder="0712 345 678"
        autoComplete="tel"
        helperText="Used for M-Pesa subscription payments. Safaricom or Airtel mobile number."
        defaultValue={defaultPhone}
        required
      />

      <Button type="submit" className="w-full" isLoading={isLoading}>
        Continue to choose a plan
        {!isLoading && <ArrowRight className="h-4 w-4" />}
      </Button>
    </form>
  );
}
