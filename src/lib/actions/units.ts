'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getUser } from '@/lib/supabase/server';
import { Unit, UnitStatus } from '@/types';

export type UnitResult = {
  error?: string;
  success?: boolean;
  data?: Unit | Unit[];
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

export async function getUnit(id: string): Promise<UnitResult> {
  const supabase = await createClient();
  const { user } = await getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { data, error } = await supabase
    .from('units')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return { error: error.message };
  }

  return { data: data as Unit };
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
  return { success: true };
}
