'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getUser } from '@/lib/supabase/server';
import { Tenant } from '@/types';

export type TenantWithLease = Tenant & {
  lease_tenants?: Array<{
    lease: {
      id: string;
      status: string;
      unit: {
        id: string;
        unit_number: string;
        property: {
          id: string;
          name: string;
        } | null;
      } | null;
    } | null;
  }>;
  current_unit?: string | null;
  current_unit_id?: string | null;
  current_property?: string | null;
  current_lease_id?: string | null;
  lease_status?: string;
};

export type TenantResult = {
  error?: string;
  success?: boolean;
  data?: Tenant | Tenant[] | TenantWithLease | TenantWithLease[];
};

export type TenantFilters = {
  search?: string;
};

export async function getTenants(filters?: TenantFilters): Promise<TenantResult> {
  const supabase = await createClient();
  const { user } = await getUser();

  if (!user) return { error: 'Not authenticated' };

  let query = supabase
    .from('tenants')
    .select(`
      *,
      lease_tenants(
        lease:leases(
          id,
          status,
          unit:units(
            id,
            unit_number,
            property:properties(id, name)
          )
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (filters?.search) {
    query = query.or(
      `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;

  if (error) return { error: error.message };

  const tenantsWithLease = (data as any[]).map((tenant) => {
    const activeLeaseTenant = tenant.lease_tenants?.find(
      (lt: any) => lt.lease?.status === 'active'
    );
    return {
      ...tenant,
      current_unit: activeLeaseTenant?.lease?.unit?.unit_number || null,
      current_unit_id: activeLeaseTenant?.lease?.unit?.id || null,
      current_property: activeLeaseTenant?.lease?.unit?.property?.name || null,
      current_lease_id: activeLeaseTenant?.lease?.id || null,
      lease_status: activeLeaseTenant ? activeLeaseTenant.lease?.status : 'inactive',
    };
  });

  return { data: tenantsWithLease as TenantWithLease[] };
}

export async function getTenant(id: string): Promise<TenantResult> {
  const supabase = await createClient();
  const { user } = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('tenants')
    .select(`
      *,
      lease_tenants(
        lease:leases(
          id,
          status,
          start_date,
          end_date,
          monthly_rent,
          due_day,
          unit:units(
            id,
            unit_number,
            property:properties(id, name)
          )
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error) return { error: error.message };

  const activeLeaseTenant = (data as any).lease_tenants?.find(
    (lt: any) => lt.lease?.status === 'active'
  );
  const tenant: TenantWithLease = {
    ...data,
    current_unit: activeLeaseTenant?.lease?.unit?.unit_number || null,
    current_unit_id: activeLeaseTenant?.lease?.unit?.id || null,
    current_property: activeLeaseTenant?.lease?.unit?.property?.name || null,
    current_lease_id: activeLeaseTenant?.lease?.id || null,
    lease_status: activeLeaseTenant ? activeLeaseTenant.lease?.status : 'inactive',
  };

  return { data: tenant };
}

export async function createTenant(formData: FormData): Promise<TenantResult> {
  const supabase = await createClient();
  const { user } = await getUser();

  if (!user) return { error: 'Not authenticated' };

  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;
  const email = formData.get('email') as string;
  const phone = formData.get('phone') as string;
  const notes = formData.get('notes') as string | null;

  if (!firstName || !lastName || !email || !phone) {
    return { error: 'First name, last name, email, and phone are required' };
  }

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      notes: notes || null,
    })
    .select()
    .single();

  if (tenantError) return { error: tenantError.message };

  const unitId = formData.get('unitId') as string | null;
  if (unitId) {
    const startDate = formData.get('startDate') as string;
    const endDate = formData.get('endDate') as string;
    const monthlyRent = parseFloat(formData.get('monthlyRent') as string);
    const dueDay = parseInt(formData.get('dueDay') as string) || 1;

    if (startDate && endDate && !isNaN(monthlyRent)) {
      const { data: lease, error: leaseError } = await supabase
        .from('leases')
        .insert({
          unit_id: unitId,
          start_date: startDate,
          end_date: endDate,
          monthly_rent: monthlyRent,
          due_day: dueDay,
          late_fee_amount: 0,
          late_fee_grace_days: 5,
          status: 'active',
        })
        .select()
        .single();

      if (!leaseError && lease) {
        await supabase.from('lease_tenants').insert({
          lease_id: lease.id,
          tenant_id: tenant.id,
          is_primary: true,
        });

        await supabase
          .from('units')
          .update({ status: 'occupied' })
          .eq('id', unitId);

        // Generate one payment record per month for the lease period
        const start = new Date(startDate);
        const end = new Date(endDate);
        const paymentRecords: { lease_id: string; amount: number; due_date: string; status: string; late_fee: number }[] = [];
        let current = new Date(start.getFullYear(), start.getMonth(), dueDay);
        if (current < start) {
          current = new Date(start.getFullYear(), start.getMonth() + 1, dueDay);
        }
        while (current <= end) {
          paymentRecords.push({
            lease_id: lease.id,
            amount: monthlyRent,
            due_date: current.toISOString().split('T')[0],
            status: 'pending',
            late_fee: 0,
          });
          current = new Date(current.getFullYear(), current.getMonth() + 1, dueDay);
        }
        if (paymentRecords.length > 0) {
          await supabase.from('payments').insert(paymentRecords);
        }
      }
    }
  }

  revalidatePath('/tenants');
  revalidatePath('/units');
  revalidatePath('/payments');
  revalidatePath('/leases');
  return { success: true, data: tenant as Tenant };
}

export async function updateTenant(id: string, formData: FormData): Promise<TenantResult> {
  const supabase = await createClient();
  const { user } = await getUser();

  if (!user) return { error: 'Not authenticated' };

  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;
  const email = formData.get('email') as string;
  const phone = formData.get('phone') as string;
  const notes = formData.get('notes') as string | null;

  const { data, error } = await supabase
    .from('tenants')
    .update({
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      notes: notes || null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath('/tenants');
  return { success: true, data: data as Tenant };
}

export async function deleteTenant(id: string): Promise<TenantResult> {
  const supabase = await createClient();
  const { user } = await getUser();

  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('tenants')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/tenants');
  return { success: true };
}
