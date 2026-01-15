'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient, getUser } from '@/lib/supabase/server';
import { Property, PropertyType } from '@/types';

export type PropertyResult = {
  error?: string;
  success?: boolean;
  data?: Property | Property[];
};

export type PropertyFilters = {
  search?: string;
  propertyType?: PropertyType;
  includeArchived?: boolean;
};

export async function getProperties(filters?: PropertyFilters): Promise<PropertyResult> {
  const supabase = await createServerSupabaseClient();
  const { user } = await getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  let query = supabase
    .from('properties')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  if (!filters?.includeArchived) {
    query = query.eq('is_archived', false);
  }

  if (filters?.propertyType) {
    query = query.eq('property_type', filters.propertyType);
  }

  if (filters?.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,address_line1.ilike.%${filters.search}%,city.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    return { error: error.message };
  }

  return { data: data as Property[] };
}

export async function getProperty(id: string): Promise<PropertyResult> {
  const supabase = await createServerSupabaseClient();
  const { user } = await getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return { error: error.message };
  }

  return { data: data as Property };
}

export async function createProperty(formData: FormData): Promise<PropertyResult> {
  const supabase = await createServerSupabaseClient();
  const { user } = await getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const name = formData.get('name') as string;
  const propertyType = formData.get('propertyType') as PropertyType;
  const addressLine1 = formData.get('addressLine1') as string;
  const addressLine2 = formData.get('addressLine2') as string | null;
  const city = formData.get('city') as string;
  const state = formData.get('state') as string;
  const zipCode = formData.get('zipCode') as string;
  const country = (formData.get('country') as string) || 'USA';
  const description = formData.get('description') as string | null;

  if (!name || !propertyType || !addressLine1 || !city || !state || !zipCode) {
    return { error: 'Required fields are missing' };
  }

  const { data, error } = await supabase
    .from('properties')
    .insert({
      owner_id: user.id,
      name,
      property_type: propertyType,
      address_line1: addressLine1,
      address_line2: addressLine2,
      city,
      state,
      zip_code: zipCode,
      country,
      description,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/properties');
  return { success: true, data: data as Property };
}

export async function updateProperty(id: string, formData: FormData): Promise<PropertyResult> {
  const supabase = await createServerSupabaseClient();
  const { user } = await getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const name = formData.get('name') as string;
  const propertyType = formData.get('propertyType') as PropertyType;
  const addressLine1 = formData.get('addressLine1') as string;
  const addressLine2 = formData.get('addressLine2') as string | null;
  const city = formData.get('city') as string;
  const state = formData.get('state') as string;
  const zipCode = formData.get('zipCode') as string;
  const country = (formData.get('country') as string) || 'USA';
  const description = formData.get('description') as string | null;

  const { data, error } = await supabase
    .from('properties')
    .update({
      name,
      property_type: propertyType,
      address_line1: addressLine1,
      address_line2: addressLine2,
      city,
      state,
      zip_code: zipCode,
      country,
      description,
    })
    .eq('id', id)
    .eq('owner_id', user.id)
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/properties');
  revalidatePath(`/properties/${id}`);
  return { success: true, data: data as Property };
}

export async function deleteProperty(id: string): Promise<PropertyResult> {
  const supabase = await createServerSupabaseClient();
  const { user } = await getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  // Soft delete by archiving
  const { error } = await supabase
    .from('properties')
    .update({ is_archived: true })
    .eq('id', id)
    .eq('owner_id', user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/properties');
  return { success: true };
}
