'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UserRole } from '@/types';
import { cookies } from 'next/headers'


export type AuthResult = {
  error?: string;
  success?: boolean;
};

export async function signUp(formData: FormData): Promise<AuthResult> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const fullName = formData.get('fullName') as string;
  const role = formData.get('role') as UserRole;

  if (!email || !password || !fullName || !role) {
    return { error: 'All fields are required' };
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters' };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: role,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Profile is auto-created by database trigger using the metadata
  redirect('/dashboard');
}

export async function signIn(formData: FormData): Promise<AuthResult> {
  const supabase = await createServerSupabaseClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect('/dashboard');
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function resetPassword(formData: FormData): Promise<AuthResult> {
  const supabase = await createServerSupabaseClient();

  const email = formData.get('email') as string;

  if (!email) {
    return { error: 'Email is required' };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?type=recovery`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
