'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getUser } from '@/lib/supabase/server';
import { Lease, LeaseStatus } from '@/types';

export type LeaseWithDetails = Lease & {
  unit: {
    id: string;
    unit_number: string;
    property: { id: string; name: string; owner_id: string };
  } | null;
  lease_tenants: Array<{
    is_primary: boolean;
    tenant: { id: string; first_name: string; last_name: string } | null;
  }>;
  // Computed
  tenant_name?: string;
  property_name?: string;
};

export type LeaseFilters = {
  search?: string;
  status?: LeaseStatus;
};

export type LeaseResult = {
  error?: string;
  success?: boolean;
  data?: LeaseWithDetails | LeaseWithDetails[];
};

// Shared helper — generates one payment record per due date within a lease period
async function generateMonthlyPayments(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  leaseId: string,
  startDate: string,
  endDate: string,
  monthlyRent: number,
  dueDay: number
) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const records: { lease_id: string; amount: number; due_date: string; status: string; late_fee: number }[] = [];

  // First due date: if dueDay >= start.getDate(), use same month; otherwise next month
  let current = new Date(start.getFullYear(), start.getMonth(), dueDay);
  if (current < start) {
    current = new Date(start.getFullYear(), start.getMonth() + 1, dueDay);
  }

  while (current <= end) {
    records.push({
      lease_id: leaseId,
      amount: monthlyRent,
      due_date: current.toISOString().split('T')[0],
      status: 'pending',
      late_fee: 0,
    });
    current = new Date(current.getFullYear(), current.getMonth() + 1, dueDay);
  }

  if (records.length > 0) {
    await supabase.from('payments').insert(records);
  }
}

export async function getLeases(filters?: LeaseFilters): Promise<LeaseResult> {
  const supabase = await createClient();
  const { user } = await getUser();
  if (!user) return { error: 'Not authenticated' };

  let query = supabase
    .from('leases')
    .select(`
      *,
      unit:units!inner(
        id,
        unit_number,
        property:properties!inner(id, name, owner_id)
      ),
      lease_tenants(
        is_primary,
        tenant:tenants(id, first_name, last_name)
      )
    `)
    .eq('unit.property.owner_id', user.id)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };

  const result = (data as any[]).map((lease) => {
    const primary = lease.lease_tenants?.find((lt: any) => lt.is_primary)?.tenant
      ?? lease.lease_tenants?.[0]?.tenant;
    return {
      ...lease,
      tenant_name: primary ? `${primary.first_name} ${primary.last_name}` : 'No tenant',
      property_name: lease.unit?.property?.name,
    };
  });

  return { data: result as LeaseWithDetails[] };
}

export async function getLease(id: string): Promise<LeaseResult> {
  const supabase = await createClient();
  const { user } = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('leases')
    .select(`
      *,
      unit:units(
        id,
        unit_number,
        monthly_rent,
        property:properties(id, name)
      ),
      lease_tenants(
        is_primary,
        tenant:tenants(id, first_name, last_name, email, phone)
      )
    `)
    .eq('id', id)
    .single();

  if (error) return { error: error.message };
  return { data: data as LeaseWithDetails };
}

export async function updateLease(id: string, formData: FormData): Promise<LeaseResult> {
  const supabase = await createClient();
  const { user } = await getUser();
  if (!user) return { error: 'Not authenticated' };

  // Verify ownership
  const { data: existing } = await supabase
    .from('leases')
    .select('id, unit_id, unit:units!inner(property:properties!inner(owner_id))')
    .eq('id', id)
    .eq('unit.property.owner_id', user.id)
    .single();

  if (!existing) return { error: 'Lease not found or access denied' };

  const startDate = formData.get('startDate') as string;
  const endDate = formData.get('endDate') as string;
  const monthlyRent = parseFloat(formData.get('monthlyRent') as string);
  const securityDeposit = formData.get('securityDeposit')
    ? parseFloat(formData.get('securityDeposit') as string)
    : null;
  const dueDay = parseInt(formData.get('dueDay') as string) || 1;
  const status = (formData.get('status') as string) || 'active';
  const notes = (formData.get('notes') as string) || null;

  if (!startDate || !endDate || isNaN(monthlyRent)) {
    return { error: 'Start date, end date, and monthly rent are required' };
  }

  const { data, error } = await supabase
    .from('leases')
    .update({ start_date: startDate, end_date: endDate, monthly_rent: monthlyRent, security_deposit: securityDeposit, due_day: dueDay, status, notes })
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: error.message };

  // If terminated/expired, free the unit
  if (status === 'terminated' || status === 'expired') {
    await supabase
      .from('units')
      .update({ status: 'available' })
      .eq('id', (existing as any).unit_id);
  }

  revalidatePath('/leases');
  revalidatePath('/tenants');
  revalidatePath('/units');
  revalidatePath('/dashboard');
  return { success: true, data: data as LeaseWithDetails };
}

export async function deleteLease(id: string): Promise<LeaseResult> {
  const supabase = await createClient();
  const { user } = await getUser();
  if (!user) return { error: 'Not authenticated' };

  // Verify ownership and get unit_id
  const { data: lease } = await supabase
    .from('leases')
    .select('id, unit_id, unit:units!inner(property:properties!inner(owner_id))')
    .eq('id', id)
    .eq('unit.property.owner_id', user.id)
    .single();

  if (!lease) return { error: 'Lease not found or access denied' };

  // Delete payments and tenant links first, then the lease
  await supabase.from('payments').delete().eq('lease_id', id);
  await supabase.from('lease_tenants').delete().eq('lease_id', id);

  const { error } = await supabase.from('leases').delete().eq('id', id);
  if (error) return { error: error.message };

  // Free up the unit
  await supabase
    .from('units')
    .update({ status: 'available' })
    .eq('id', (lease as any).unit_id);

  revalidatePath('/leases');
  revalidatePath('/tenants');
  revalidatePath('/units');
  revalidatePath('/payments');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function createLease(formData: FormData): Promise<LeaseResult> {
  const supabase = await createClient();
  const { user } = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const unitId = formData.get('unitId') as string;
  const tenantId = formData.get('tenantId') as string | null;
  const startDate = formData.get('startDate') as string;
  const endDate = formData.get('endDate') as string;
  const monthlyRent = parseFloat(formData.get('monthlyRent') as string);
  const securityDeposit = formData.get('securityDeposit')
    ? parseFloat(formData.get('securityDeposit') as string)
    : null;
  const dueDay = parseInt(formData.get('dueDay') as string) || 1;
  const notes = formData.get('notes') as string | null;

  if (!unitId || !startDate || !endDate || isNaN(monthlyRent)) {
    return { error: 'Unit, dates, and monthly rent are required' };
  }

  const { data: lease, error: leaseError } = await supabase
    .from('leases')
    .insert({
      unit_id: unitId,
      start_date: startDate,
      end_date: endDate,
      monthly_rent: monthlyRent,
      security_deposit: securityDeposit,
      due_day: dueDay,
      late_fee_amount: 0,
      late_fee_grace_days: 5,
      status: 'active',
      notes: notes || null,
    })
    .select()
    .single();

  if (leaseError) return { error: leaseError.message };

  if (tenantId) {
    await supabase.from('lease_tenants').insert({
      lease_id: lease.id,
      tenant_id: tenantId,
      is_primary: true,
    });
  }

  await supabase.from('units').update({ status: 'occupied' }).eq('id', unitId);
  await generateMonthlyPayments(supabase, lease.id, startDate, endDate, monthlyRent, dueDay);

  revalidatePath('/leases');
  revalidatePath('/payments');
  revalidatePath('/tenants');
  revalidatePath('/units');
  return { success: true, data: lease as unknown as LeaseWithDetails };
}
