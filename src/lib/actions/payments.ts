'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getUser } from '@/lib/supabase/server';
import { Payment, PaymentStatus } from '@/types';

export type PaymentWithDetails = Payment & {
  tenant_name: string;
  property_name: string;
  unit_number: string;
  lease: {
    id: string;
    monthly_rent: number;
    unit: {
      id: string;
      unit_number: string;
      property: { id: string; name: string; owner_id: string };
    } | null;
    lease_tenants: Array<{
      tenant: { id: string; first_name: string; last_name: string } | null;
    }>;
  } | null;
};

export type PaymentStats = {
  totalRevenueThisMonth: number;
  overdueAmount: number;
  pendingAmount: number;
  collectionRate: number;
  totalPaid: number;
  totalOverdue: number;
  totalPending: number;
};

export type PaymentFilters = {
  search?: string;
  status?: PaymentStatus;
  leaseId?: string;
};

export type PaymentResult = {
  error?: string;
  success?: boolean;
  data?: PaymentWithDetails | PaymentWithDetails[];
};

export async function getPayments(filters?: PaymentFilters): Promise<PaymentResult> {
  const supabase = await createClient();
  const { user } = await getUser();
  if (!user) return { error: 'Not authenticated' };

  // Auto-update overdue payments (pending past due date → overdue)
  const today = new Date().toISOString().split('T')[0];
  await supabase
    .from('payments')
    .update({ status: 'overdue' })
    .eq('status', 'pending')
    .lt('due_date', today);

  // Step 1: Get lease IDs for the user's properties, along with display data
  const { data: userLeases, error: leasesError } = await supabase
    .from('leases')
    .select(`
      id,
      monthly_rent,
      unit:units!inner(
        id,
        unit_number,
        property:properties!inner(id, name, owner_id)
      ),
      lease_tenants(
        tenant:tenants(id, first_name, last_name)
      )
    `)
    .eq('unit.property.owner_id', user.id);

  if (leasesError) return { error: leasesError.message };
  if (!userLeases || userLeases.length === 0) return { data: [] };

  const leaseIds = (userLeases as any[]).map((l) => l.id);
  const leaseMap = Object.fromEntries((userLeases as any[]).map((l) => [l.id, l]));

  // Step 2: Get payments for those leases
  let query = supabase
    .from('payments')
    .select('*')
    .in('lease_id', leaseIds)
    .order('due_date', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.leaseId) {
    query = query.eq('lease_id', filters.leaseId);
  }

  const { data: payments, error: paymentsError } = await query;
  if (paymentsError) return { error: paymentsError.message };

  const result = (payments as any[]).map((payment) => {
    const lease = leaseMap[payment.lease_id];
    const tenant = lease?.lease_tenants?.[0]?.tenant;
    return {
      ...payment,
      tenant_name: tenant ? `${tenant.first_name} ${tenant.last_name}` : 'Unknown',
      property_name: lease?.unit?.property?.name ?? '',
      unit_number: lease?.unit?.unit_number ?? '',
      lease: lease ?? null,
    };
  });

  // Client-side search filter (tenant name, property, unit)
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    return {
      data: result.filter(
        (p) =>
          p.tenant_name.toLowerCase().includes(q) ||
          p.property_name.toLowerCase().includes(q) ||
          p.unit_number.toLowerCase().includes(q)
      ) as PaymentWithDetails[],
    };
  }

  return { data: result as PaymentWithDetails[] };
}

export async function getPaymentStats(): Promise<{ error?: string; data?: PaymentStats }> {
  const supabase = await createClient();
  const { user } = await getUser();
  if (!user) return { error: 'Not authenticated' };

  // Get lease IDs for the user's properties
  const { data: userLeases } = await supabase
    .from('leases')
    .select(`
      id,
      unit:units!inner(property:properties!inner(owner_id))
    `)
    .eq('unit.property.owner_id', user.id);

  if (!userLeases || userLeases.length === 0) {
    return {
      data: {
        totalRevenueThisMonth: 0,
        overdueAmount: 0,
        pendingAmount: 0,
        collectionRate: 0,
        totalPaid: 0,
        totalOverdue: 0,
        totalPending: 0,
      },
    };
  }

  const leaseIds = (userLeases as any[]).map((l) => l.id);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data: payments, error } = await supabase
    .from('payments')
    .select('id, amount, status, due_date, paid_date')
    .in('lease_id', leaseIds);

  if (error) return { error: error.message };

  const all = payments as any[];
  const paidThisMonth = all.filter(
    (p) =>
      p.status === 'paid' &&
      p.paid_date >= startOfMonth &&
      p.paid_date <= endOfMonth
  );
  const overdue = all.filter((p) => p.status === 'overdue');
  const pending = all.filter((p) => p.status === 'pending');
  const paid = all.filter((p) => p.status === 'paid');
  const collectionRate =
    all.length > 0 ? Math.round((paid.length / all.length) * 100) : 0;

  return {
    data: {
      totalRevenueThisMonth: paidThisMonth.reduce((s, p) => s + p.amount, 0),
      overdueAmount: overdue.reduce((s, p) => s + p.amount, 0),
      pendingAmount: pending.reduce((s, p) => s + p.amount, 0),
      collectionRate,
      totalPaid: paid.length,
      totalOverdue: overdue.length,
      totalPending: pending.length,
    },
  };
}

export async function createPayment(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const { user } = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const leaseId = formData.get('leaseId') as string;
  const amountRaw = formData.get('amount') as string;
  const dueDate = formData.get('dueDate') as string;
  const status = (formData.get('status') as string) || 'pending';

  if (!leaseId || !amountRaw || !dueDate) {
    return { error: 'Lease, amount, and due date are required' };
  }

  const amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount <= 0) return { error: 'Enter a valid amount' };

  // Verify the lease belongs to the current user
  const { data: lease, error: leaseErr } = await supabase
    .from('leases')
    .select('id, unit:units!inner(property:properties!inner(owner_id))')
    .eq('id', leaseId)
    .eq('unit.property.owner_id', user.id)
    .single();

  if (leaseErr || !lease) return { error: 'Lease not found or access denied' };

  const isPaid = status === 'paid';
  const today = new Date().toISOString().split('T')[0];

  const { error } = await supabase.from('payments').insert({
    lease_id: leaseId,
    amount,
    due_date: dueDate,
    status: isPaid ? 'paid' : 'pending',
    late_fee: 0,
    paid_date: isPaid ? ((formData.get('paidDate') as string) || today) : null,
    payment_method: isPaid ? (formData.get('paymentMethod') as string) || null : null,
    transaction_reference: isPaid ? (formData.get('transactionReference') as string) || null : null,
    notes: (formData.get('notes') as string) || null,
  });

  if (error) return { error: error.message };

  revalidatePath('/payments');
  revalidatePath('/tenants');
  return { success: true };
}

export async function updatePayment(
  id: string,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const { user } = await getUser();
  if (!user) return { error: 'Not authenticated' };

  // Verify payment belongs to user via lease chain
  const { data: payment } = await supabase
    .from('payments')
    .select('id, lease_id')
    .eq('id', id)
    .single();

  if (!payment) return { error: 'Payment not found' };

  const { data: lease } = await supabase
    .from('leases')
    .select('id, unit:units!inner(property:properties!inner(owner_id))')
    .eq('id', (payment as any).lease_id)
    .eq('unit.property.owner_id', user.id)
    .single();

  if (!lease) return { error: 'Access denied' };

  const amountRaw = formData.get('amount') as string;
  const dueDate = formData.get('dueDate') as string;
  const status = (formData.get('status') as string) || 'pending';
  const notes = (formData.get('notes') as string) || null;

  const amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount <= 0) return { error: 'Enter a valid amount' };
  if (!dueDate) return { error: 'Due date is required' };

  const isPaid = status === 'paid';

  const { error } = await supabase
    .from('payments')
    .update({
      amount,
      due_date: dueDate,
      status,
      notes,
      paid_date: isPaid ? ((formData.get('paidDate') as string) || null) : null,
      payment_method: isPaid ? (formData.get('paymentMethod') as string) || null : null,
      transaction_reference: isPaid
        ? (formData.get('transactionReference') as string) || null
        : null,
    })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/payments');
  revalidatePath('/tenants');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function deletePayment(
  id: string
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const { user } = await getUser();
  if (!user) return { error: 'Not authenticated' };

  // Verify payment belongs to user via lease chain
  const { data: payment } = await supabase
    .from('payments')
    .select('id, lease_id')
    .eq('id', id)
    .single();

  if (!payment) return { error: 'Payment not found' };

  const { data: lease } = await supabase
    .from('leases')
    .select('id, unit:units!inner(property:properties!inner(owner_id))')
    .eq('id', (payment as any).lease_id)
    .eq('unit.property.owner_id', user.id)
    .single();

  if (!lease) return { error: 'Access denied' };

  const { error } = await supabase.from('payments').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/payments');
  revalidatePath('/tenants');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function recordPayment(
  id: string,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const { user } = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const paidDate = (formData.get('paidDate') as string) || new Date().toISOString().split('T')[0];
  const paymentMethod = (formData.get('paymentMethod') as string) || null;
  const transactionReference = (formData.get('transactionReference') as string) || null;
  const notes = (formData.get('notes') as string) || null;
  const amountRaw = formData.get('amount') as string | null;
  const amount = amountRaw ? parseFloat(amountRaw) : undefined;

  const update: Record<string, unknown> = {
    status: 'paid',
    paid_date: paidDate,
    payment_method: paymentMethod,
    transaction_reference: transactionReference,
    notes,
  };
  if (amount !== undefined && !isNaN(amount)) {
    update.amount = amount;
  }

  const { error } = await supabase.from('payments').update(update).eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/payments');
  revalidatePath('/tenants');
  return { success: true };
}
