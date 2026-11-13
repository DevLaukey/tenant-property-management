'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getUser } from '@/lib/supabase/server';
import { isEquityStatementConfigured, syncEquityStatement, type SyncSummary } from '@/lib/payments/equity';

export type BankTransaction = {
  id: string;
  bank_reference: string;
  account_reference: string | null;
  amount: number;
  paid_at: string | null;
  payer_name: string | null;
  payer_phone: string | null;
  status: 'matched' | 'unmatched' | 'duplicate';
  match_error: string | null;
  created_at: string;
};

/** Equity credits for the current owner that could not be applied to rent. */
export async function getUnmatchedBankTransactions(): Promise<{ error?: string; data?: BankTransaction[] }> {
  const supabase = await createClient();
  const { user } = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('bank_transactions')
    .select('id, bank_reference, account_reference, amount, paid_at, payer_name, payer_phone, status, match_error, created_at')
    .eq('owner_id', user.id)
    .eq('status', 'unmatched')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return { error: error.message };
  return { data: (data ?? []) as BankTransaction[] };
}

export async function syncEquityNow(): Promise<{ error?: string; data?: SyncSummary }> {
  const { user } = await getUser();
  if (!user) return { error: 'Not authenticated' };
  if (!isEquityStatementConfigured()) {
    return { error: 'Equity statement access is not configured on the server' };
  }

  try {
    const summary = await syncEquityStatement(7);
    revalidatePath('/payments');
    revalidatePath('/tenants');
    revalidatePath('/dashboard');
    return { data: summary };
  } catch (err) {
    console.error('[equity sync] manual sync failed:', err);
    return { error: 'Could not reach Equity. Try again in a few minutes.' };
  }
}

export async function isEquitySyncAvailable(): Promise<boolean> {
  return isEquityStatementConfigured();
}
