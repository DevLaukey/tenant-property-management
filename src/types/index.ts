// Database enums
export type UserRole = 'owner' | 'property_manager' | 'tenant';
export type PropertyType = 'residential' | 'commercial' | 'mixed_use';
export type UnitStatus = 'available' | 'occupied' | 'maintenance' | 'unavailable';
export type LeaseStatus = 'active' | 'pending' | 'expired' | 'terminated';
export type PaymentStatus = 'paid' | 'partial' | 'overdue' | 'pending';
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent';
export type MaintenanceStatus = 'submitted' | 'in_progress' | 'completed' | 'cancelled';

// Database types
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  avatar_url?: string;
  organization_name?: string;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  owner_id: string;
  name: string;
  property_type: PropertyType;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  description?: string;
  total_units: number;
  image_url?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  floor?: number;
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  monthly_rent: number;
  security_deposit?: number;
  status: UnitStatus;
  description?: string;
  amenities?: string[];
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  government_id_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Lease {
  id: string;
  unit_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  security_deposit?: number;
  due_day: number;
  late_fee_amount: number;
  late_fee_grace_days: number;
  status: LeaseStatus;
  lease_document_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  lease_id: string;
  amount: number;
  due_date: string;
  paid_date?: string;
  payment_method?: string;
  transaction_reference?: string;
  status: PaymentStatus;
  late_fee: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceRequest {
  id: string;
  unit_id: string;
  tenant_id?: string;
  title: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  category?: string;
  location_details?: string;
  estimated_cost?: number;
  actual_cost?: number;
  assigned_to?: string;
  scheduled_date?: string;
  completed_date?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  name: string;
  description?: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
  property_id?: string;
  unit_id?: string;
  lease_id?: string;
  tenant_id?: string;
  uploaded_by?: string;
  created_at: string;
}
