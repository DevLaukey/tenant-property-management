'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { normalizeKenyanPhone } from '@/lib/billing/phone';
import { isPlanId } from '@/lib/billing/plans';
import { UserRole } from '@/types';

export type AuthResult = {
  error?: string;
  success?: boolean;
};

const VALID_ROLES: UserRole[] = ['owner', 'property_manager', 'tenant'];

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('already exists')) {
    return 'An account with this email already exists. Try signing in or resetting your password.';
  }
  if (m.includes('email not confirmed')) {
    return 'Please confirm your email address first. Check your inbox for the verification link, or sign up again to get a new one.';
  }
  if (m.includes('invalid login credentials')) {
    return 'Incorrect email or password.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (m.includes('same password') || m.includes('different from the old')) {
    return 'Your new password must be different from your current password.';
  }
  return message;
}

export async function signUp(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient();

  const email = str(formData, 'email').toLowerCase();
  const password = (formData.get('password') as string) || '';
  const fullName = str(formData, 'fullName');
  const role = str(formData, 'role') as UserRole;
  const rawPhone = str(formData, 'phone');
  const organizationName = str(formData, 'organizationName');
  const selectedPlan = str(formData, 'selectedPlan');

  if (!email || !password || !fullName || !role) {
    return { error: 'All fields are required' };
  }

  if (!VALID_ROLES.includes(role)) {
    return { error: 'Please choose a valid account type' };
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters' };
  }

  let phone: string | null = null;
  if (rawPhone) {
    phone = normalizeKenyanPhone(rawPhone);
    if (!phone) {
      return { error: 'Enter a valid Kenyan mobile number, e.g. 0712 345 678' };
    }
  }

  const metadata: Record<string, string> = {
    full_name: fullName,
    role,
  };
  if (phone) metadata.phone = phone;
  if (organizationName && role !== 'tenant') metadata.organization_name = organizationName;
  if (isPlanId(selectedPlan) && role !== 'tenant') metadata.selected_plan = selectedPlan;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  // With email confirmation on, Supabase hides existing accounts by returning
  // a user with no identities instead of an error.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { error: friendlyAuthError('User already registered') };
  }

  // Profile (and trial subscription for owners/managers) is created by DB triggers.
  if (!data.session) {
    redirect(`/verify-email?email=${encodeURIComponent(email)}`);
  }

  redirect(role === 'tenant' ? '/dashboard' : '/onboarding');
}

export async function signIn(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient();

  const email = str(formData, 'email').toLowerCase();
  const password = (formData.get('password') as string) || '';

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.toLowerCase().includes('email not confirmed')) {
      return {
        error:
          'Your email address is not verified yet. Check your inbox for the confirmation link — you can request a new one from the verification page.',
      };
    }
    return { error: friendlyAuthError(error.message) };
  }

  // The proxy routes the user to /onboarding or /billing when needed.
  redirect('/dashboard');
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function resetPassword(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient();

  const email = str(formData, 'email').toLowerCase();

  if (!email) {
    return { error: 'Email is required' };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?type=recovery`,
  });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  return { success: true };
}

export async function updatePassword(formData: FormData): Promise<AuthResult> {
  const password = (formData.get('password') as string) || '';
  const confirmPassword = (formData.get('confirmPassword') as string) || '';

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters' };
  }
  if (password !== confirmPassword) {
    return { error: 'Passwords do not match' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Your password reset link has expired. Please request a new one.' };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  redirect('/dashboard');
}

export async function resendVerification(email: string): Promise<AuthResult> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { error: 'A valid email address is required' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: cleanEmail,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  return { success: true };
}

export async function completeOnboarding(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = (profile?.role ?? user.user_metadata?.role ?? 'owner') as UserRole;
  const isBusiness = role === 'owner' || role === 'property_manager';

  const fullName = str(formData, 'fullName');
  const organizationName = str(formData, 'organizationName');
  const phone = normalizeKenyanPhone(str(formData, 'phone'));

  if (!fullName) {
    return { error: 'Your full name is required' };
  }
  if (isBusiness && !organizationName) {
    return { error: 'Business or organization name is required' };
  }
  if (!phone) {
    return { error: 'Enter a valid Kenyan mobile number, e.g. 0712 345 678' };
  }

  const { data: updated, error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      phone,
      organization_name: isBusiness ? organizationName : null,
      onboarding_completed: true,
    })
    .eq('id', user.id)
    .select('id');

  if (error) {
    return { error: `Could not save your details: ${error.message}` };
  }
  if (!updated || updated.length === 0) {
    return { error: 'Your profile could not be found. Please contact support.' };
  }

  if (!isBusiness) {
    redirect('/dashboard');
  }

  const selectedPlan = user.user_metadata?.selected_plan;
  redirect(isPlanId(selectedPlan) ? `/billing?welcome=1&plan=${selectedPlan}` : '/billing?welcome=1');
}
