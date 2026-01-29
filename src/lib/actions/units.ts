'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getUser } from '@/lib/supabase/server';
import { Unit, UnitStatus, Property } from '@/types';

export type UnitWithProperty = Unit & {
  property: Pick<Property, 'id' | 'name' | 'address_line1' | 'city' | 'state'>;
};

export type UnitResult = {
  error?: string;
  success?: boolean;
  data?: Unit | Unit[] | UnitWithProperty | UnitWithProperty[];
};

export type UnitFilters = {
  search?: string;
  status?: UnitStatus;
  propertyId?: string;
};

export async function getUnits(propertyId: string): Promise<UnitResult> {
  const supabase = await createClient();
  const { user } = await getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { data, error } = await supabase
    .from('units')
    .select('*')
    .eq('property_id', propertyId)
    .eq('is_archived', false)
    .order('unit_number', { ascending: true });

  if (error) {
    return { error: error.message };
  }

  return { data: data as Unit[] };
}

export async function getAllUnits(filters?: UnitFilters): Promise<UnitResult> {
  const supabase = await createClient();
  const { user } = await getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  let query = supabase
    .from('units')
    .select(`
      *,
      property:properties!inner(id, name, address_line1, city, state, owner_id)
    `)
    .eq('is_archived', false)
    .eq('property.owner_id', user.id)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.propertyId) {
    query = query.eq('property_id', filters.propertyId);
  }

  if (filters?.search) {
    query = query.or(
      `unit_number.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    return { error: error.message };
  }

  return { data: data as UnitWithProperty[] };
}

export async function getUnit(id: string): Promise<UnitResult> {
  const supabase = await createClient();
  const { user } = await getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { data, error } = await supabase
    .from('units')
    .select(`
      *,
      property:properties!inner(id, name, address_line1, city, state, owner_id)
    `)
    .eq('id', id)
    .single();

  if (error) {
    return { error: error.message };
  }

  return { data: data as UnitWithProperty };
}

export async function createUnit(propertyId: string, formData: FormData): Promise<UnitResult> {
  const supabase = await createClient();
  const { user } = await getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const unitNumber = formData.get('unitNumber') as string;
  const floor = formData.get('floor') ? parseInt(formData.get('floor') as string) : null;
  const bedrooms = formData.get('bedrooms') ? parseFloat(formData.get('bedrooms') as string) : null;
  const bathrooms = formData.get('bathrooms') ? parseFloat(formData.get('bathrooms') as string) : null;
  const squareFeet = formData.get('squareFeet') ? parseInt(formData.get('squareFeet') as string) : null;
  const monthlyRent = parseFloat(formData.get('monthlyRent') as string);
  const securityDeposit = formData.get('securityDeposit') ? parseFloat(formData.get('securityDeposit') as string) : null;
  const status = (formData.get('status') as UnitStatus) || 'available';
  const description = formData.get('description') as string | null;

  if (!unitNumber || !monthlyRent) {
    return { error: 'Unit number and monthly rent are required' };
  }

  const { data, error } = await supabase
    .from('units')
    .insert({
      property_id: propertyId,
      unit_number: unitNumber,
      floor,
      bedrooms,
      bathrooms,
      square_feet: squareFeet,
      monthly_rent: monthlyRent,
      security_deposit: securityDeposit,
      status,
      description,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/properties/${propertyId}`);
  revalidatePath('/units');
  return { success: true, data: data as Unit };
}

export async function updateUnit(id: string, propertyId: string, formData: FormData): Promise<UnitResult> {
  const supabase = await createClient();
  const { user } = await getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const unitNumber = formData.get('unitNumber') as string;
  const floor = formData.get('floor') ? parseInt(formData.get('floor') as string) : null;
  const bedrooms = formData.get('bedrooms') ? parseFloat(formData.get('bedrooms') as string) : null;
  const bathrooms = formData.get('bathrooms') ? parseFloat(formData.get('bathrooms') as string) : null;
  const squareFeet = formData.get('squareFeet') ? parseInt(formData.get('squareFeet') as string) : null;
  const monthlyRent = parseFloat(formData.get('monthlyRent') as string);
  const securityDeposit = formData.get('securityDeposit') ? parseFloat(formData.get('securityDeposit') as string) : null;
  const status = (formData.get('status') as UnitStatus) || 'available';
  const description = formData.get('description') as string | null;

  const { data, error } = await supabase
    .from('units')
    .update({
      unit_number: unitNumber,
      floor,
      bedrooms,
      bathrooms,
      square_feet: squareFeet,
      monthly_rent: monthlyRent,
      security_deposit: securityDeposit,
      status,
      description,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/properties/${propertyId}`);
  revalidatePath('/units');
  revalidatePath(`/units/${id}`);
  return { success: true, data: data as Unit };
}

export async function deleteUnit(id: string, propertyId: string): Promise<UnitResult> {
  const supabase = await createClient();
  const { user } = await getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  // Soft delete by archiving
  const { error } = await supabase
    .from('units')
    .update({ is_archived: true })
    .eq('id', id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/properties/${propertyId}`);
  revalidatePath('/units');
  return { success: true };
}
