-- =====================================================
-- RENTAL MANAGEMENT SYSTEM - DATABASE SCHEMA
-- =====================================================
-- Supabase PostgreSQL Schema with RLS Policies
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE user_role AS ENUM ('owner', 'property_manager', 'tenant');
CREATE TYPE property_type AS ENUM ('residential', 'commercial', 'mixed_use');
CREATE TYPE unit_status AS ENUM ('available', 'occupied', 'maintenance', 'unavailable');
CREATE TYPE lease_status AS ENUM ('active', 'pending', 'expired', 'terminated');
CREATE TYPE payment_status AS ENUM ('paid', 'partial', 'overdue', 'pending');
CREATE TYPE maintenance_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE maintenance_status AS ENUM ('submitted', 'in_progress', 'completed', 'cancelled');

-- =====================================================
-- TABLES
-- =====================================================

-- -----------------------------------------------------
-- User Profiles (extends Supabase Auth)
-- -----------------------------------------------------
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'tenant',
    avatar_url TEXT,
    organization_name TEXT, -- For owners/managers
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------
-- Properties
-- -----------------------------------------------------
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    property_type property_type NOT NULL DEFAULT 'residential',
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip_code TEXT NOT NULL,
    country TEXT DEFAULT 'USA',
    description TEXT,
    total_units INTEGER DEFAULT 0,
    image_url TEXT,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for owner queries
CREATE INDEX idx_properties_owner ON properties(owner_id);
CREATE INDEX idx_properties_archived ON properties(is_archived);

-- -----------------------------------------------------
-- Property Managers (Junction Table)
-- -----------------------------------------------------
CREATE TABLE property_managers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(property_id, manager_id)
);

CREATE INDEX idx_property_managers_property ON property_managers(property_id);
CREATE INDEX idx_property_managers_manager ON property_managers(manager_id);

-- -----------------------------------------------------
-- Units
-- -----------------------------------------------------
CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    unit_number TEXT NOT NULL,
    floor INTEGER,
    bedrooms DECIMAL(3,1), -- Supports 0.5 for studios
    bathrooms DECIMAL(3,1),
    square_feet INTEGER,
    monthly_rent DECIMAL(10,2) NOT NULL,
    security_deposit DECIMAL(10,2),
    status unit_status DEFAULT 'available',
    description TEXT,
    amenities TEXT[], -- Array of amenities
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(property_id, unit_number)
);

CREATE INDEX idx_units_property ON units(property_id);
CREATE INDEX idx_units_status ON units(status);

-- -----------------------------------------------------
-- Tenants
-- -----------------------------------------------------
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Optional: linked to auth user
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    date_of_birth DATE,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relationship TEXT,
    government_id_url TEXT, -- Stored in Supabase Storage
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tenants_email ON tenants(email);
CREATE INDEX idx_tenants_user ON tenants(user_id);

-- -----------------------------------------------------
-- Leases
-- -----------------------------------------------------
CREATE TABLE leases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    monthly_rent DECIMAL(10,2) NOT NULL,
    security_deposit DECIMAL(10,2),
    due_day INTEGER DEFAULT 1 CHECK (due_day BETWEEN 1 AND 31), -- Day of month rent is due
    late_fee_amount DECIMAL(10,2) DEFAULT 0,
    late_fee_grace_days INTEGER DEFAULT 5,
    status lease_status DEFAULT 'pending',
    lease_document_url TEXT, -- PDF in Supabase Storage
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (end_date > start_date)
);

CREATE INDEX idx_leases_unit ON leases(unit_id);
CREATE INDEX idx_leases_status ON leases(status);
CREATE INDEX idx_leases_dates ON leases(start_date, end_date);

-- -----------------------------------------------------
-- Lease Tenants (Junction Table - supports multiple tenants per lease)
-- -----------------------------------------------------
CREATE TABLE lease_tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(lease_id, tenant_id)
);

CREATE INDEX idx_lease_tenants_lease ON lease_tenants(lease_id);
CREATE INDEX idx_lease_tenants_tenant ON lease_tenants(tenant_id);

-- -----------------------------------------------------
-- Payments
-- -----------------------------------------------------
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE,
    payment_method TEXT, -- e.g., 'check', 'bank_transfer', 'cash', 'online'
    transaction_reference TEXT,
    status payment_status DEFAULT 'pending',
    late_fee DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_lease ON payments(lease_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_due_date ON payments(due_date);
CREATE INDEX idx_payments_paid_date ON payments(paid_date);

-- -----------------------------------------------------
-- Maintenance Requests
-- -----------------------------------------------------
CREATE TABLE maintenance_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority maintenance_priority DEFAULT 'medium',
    status maintenance_status DEFAULT 'submitted',
    category TEXT, -- e.g., 'plumbing', 'electrical', 'hvac', 'appliance'
    location_details TEXT, -- Specific location within unit
    estimated_cost DECIMAL(10,2),
    actual_cost DECIMAL(10,2),
    assigned_to TEXT, -- Vendor or maintenance person name
    scheduled_date TIMESTAMPTZ,
    completed_date TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_maintenance_unit ON maintenance_requests(unit_id);
CREATE INDEX idx_maintenance_tenant ON maintenance_requests(tenant_id);
CREATE INDEX idx_maintenance_status ON maintenance_requests(status);
CREATE INDEX idx_maintenance_priority ON maintenance_requests(priority);

-- -----------------------------------------------------
-- Maintenance Request Images
-- -----------------------------------------------------
CREATE TABLE maintenance_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    maintenance_request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    caption TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_maintenance_images_request ON maintenance_images(maintenance_request_id);

-- -----------------------------------------------------
-- Documents (Generic document storage)
-- -----------------------------------------------------
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type TEXT, -- MIME type
    file_size INTEGER, -- bytes
    -- Polymorphic associations
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    lease_id UUID REFERENCES leases(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_property ON documents(property_id);
CREATE INDEX idx_documents_unit ON documents(unit_id);
CREATE INDEX idx_documents_lease ON documents(lease_id);
CREATE INDEX idx_documents_tenant ON documents(tenant_id);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leases_updated_at BEFORE UPDATE ON leases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_maintenance_requests_updated_at BEFORE UPDATE ON maintenance_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update property total_units
CREATE OR REPLACE FUNCTION update_property_total_units()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE properties
    SET total_units = (
        SELECT COUNT(*)
        FROM units
        WHERE property_id = COALESCE(NEW.property_id, OLD.property_id)
        AND is_archived = FALSE
    )
    WHERE id = COALESCE(NEW.property_id, OLD.property_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_units_count AFTER INSERT OR UPDATE OR DELETE ON units
    FOR EACH ROW EXECUTE FUNCTION update_property_total_units();

-- Auto-update unit status based on active lease
CREATE OR REPLACE FUNCTION update_unit_status_from_lease()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'active' THEN
        UPDATE units SET status = 'occupied' WHERE id = NEW.unit_id;
    ELSIF OLD.status = 'active' AND NEW.status != 'active' THEN
        UPDATE units SET status = 'available' WHERE id = NEW.unit_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lease_status_update_unit AFTER INSERT OR UPDATE ON leases
    FOR EACH ROW EXECUTE FUNCTION update_unit_status_from_lease();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PROFILES POLICIES
-- =====================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- =====================================================
-- PROPERTIES POLICIES
-- =====================================================

-- Owners can view their own properties
CREATE POLICY "Owners can view own properties"
    ON properties FOR SELECT
    USING (
        owner_id = auth.uid()
        OR
        id IN (SELECT property_id FROM property_managers WHERE manager_id = auth.uid())
    );

-- Tenants can view properties they rent in
CREATE POLICY "Tenants can view their properties"
    ON properties FOR SELECT
    USING (
        id IN (
            SELECT DISTINCT p.id
            FROM properties p
            JOIN units u ON u.property_id = p.id
            JOIN leases l ON l.unit_id = u.id
            JOIN lease_tenants lt ON lt.lease_id = l.id
            JOIN tenants t ON t.id = lt.tenant_id
            WHERE t.user_id = auth.uid()
            AND l.status = 'active'
        )
    );

-- Owners can insert their own properties
CREATE POLICY "Owners can create properties"
    ON properties FOR INSERT
    WITH CHECK (owner_id = auth.uid());

-- Owners can update their own properties
CREATE POLICY "Owners can update own properties"
    ON properties FOR UPDATE
    USING (owner_id = auth.uid());

-- Owners and managers can delete properties
CREATE POLICY "Owners can delete own properties"
    ON properties FOR DELETE
    USING (owner_id = auth.uid());

-- =====================================================
-- PROPERTY MANAGERS POLICIES
-- =====================================================

-- Property owners can manage property managers
CREATE POLICY "Owners can manage property managers"
    ON property_managers FOR ALL
    USING (
        property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
    );

-- =====================================================
-- UNITS POLICIES
-- =====================================================

-- Owners/Managers can view units in their properties
CREATE POLICY "Owners/Managers can view units"
    ON units FOR SELECT
    USING (
        property_id IN (
            SELECT id FROM properties
            WHERE owner_id = auth.uid()
            OR id IN (SELECT property_id FROM property_managers WHERE manager_id = auth.uid())
        )
    );

-- Tenants can view their units
CREATE POLICY "Tenants can view own units"
    ON units FOR SELECT
    USING (
        id IN (
            SELECT l.unit_id
            FROM leases l
            JOIN lease_tenants lt ON lt.lease_id = l.id
            JOIN tenants t ON t.id = lt.tenant_id
            WHERE t.user_id = auth.uid()
            AND l.status = 'active'
        )
    );

-- Owners/Managers can manage units
CREATE POLICY "Owners/Managers can manage units"
    ON units FOR ALL
    USING (
        property_id IN (
            SELECT id FROM properties
            WHERE owner_id = auth.uid()
            OR id IN (SELECT property_id FROM property_managers WHERE manager_id = auth.uid())
        )
    );

-- =====================================================
-- TENANTS POLICIES
-- =====================================================

-- Owners/Managers can view all tenants in their properties
CREATE POLICY "Owners/Managers can view tenants"
    ON tenants FOR SELECT
    USING (
        id IN (
            SELECT lt.tenant_id
            FROM lease_tenants lt
            JOIN leases l ON l.id = lt.lease_id
            JOIN units u ON u.id = l.unit_id
            JOIN properties p ON p.id = u.property_id
            WHERE p.owner_id = auth.uid()
            OR p.id IN (SELECT property_id FROM property_managers WHERE manager_id = auth.uid())
        )
    );

-- Tenants can view their own profile
CREATE POLICY "Tenants can view own profile"
    ON tenants FOR SELECT
    USING (user_id = auth.uid());

-- Owners/Managers can manage tenants
CREATE POLICY "Owners/Managers can manage tenants"
    ON tenants FOR ALL
    USING (
        id IN (
            SELECT lt.tenant_id
            FROM lease_tenants lt
            JOIN leases l ON l.id = lt.lease_id
            JOIN units u ON u.id = l.unit_id
            JOIN properties p ON p.id = u.property_id
            WHERE p.owner_id = auth.uid()
            OR p.id IN (SELECT property_id FROM property_managers WHERE manager_id = auth.uid())
        )
        OR
        -- Allow creating new tenants
        id IS NULL
    );

-- =====================================================
-- LEASES POLICIES
-- =====================================================

-- Owners/Managers can view leases
CREATE POLICY "Owners/Managers can view leases"
    ON leases FOR SELECT
    USING (
        unit_id IN (
            SELECT u.id FROM units u
            JOIN properties p ON p.id = u.property_id
            WHERE p.owner_id = auth.uid()
            OR p.id IN (SELECT property_id FROM property_managers WHERE manager_id = auth.uid())
        )
    );

-- Tenants can view their own leases
CREATE POLICY "Tenants can view own leases"
    ON leases FOR SELECT
    USING (
        id IN (
            SELECT lt.lease_id
            FROM lease_tenants lt
            JOIN tenants t ON t.id = lt.tenant_id
            WHERE t.user_id = auth.uid()
        )
    );

-- Owners/Managers can manage leases
CREATE POLICY "Owners/Managers can manage leases"
    ON leases FOR ALL
    USING (
        unit_id IN (
            SELECT u.id FROM units u
            JOIN properties p ON p.id = u.property_id
            WHERE p.owner_id = auth.uid()
            OR p.id IN (SELECT property_id FROM property_managers WHERE manager_id = auth.uid())
        )
    );

-- =====================================================
-- LEASE TENANTS POLICIES
-- =====================================================

CREATE POLICY "Owners/Managers can manage lease tenants"
    ON lease_tenants FOR ALL
    USING (
        lease_id IN (
            SELECT l.id FROM leases l
            JOIN units u ON u.id = l.unit_id
            JOIN properties p ON p.id = u.property_id
            WHERE p.owner_id = auth.uid()
            OR p.id IN (SELECT property_id FROM property_managers WHERE manager_id = auth.uid())
        )
    );

-- =====================================================
-- PAYMENTS POLICIES
-- =====================================================

-- Owners/Managers can view payments
CREATE POLICY "Owners/Managers can view payments"
    ON payments FOR SELECT
    USING (
        lease_id IN (
            SELECT l.id FROM leases l
            JOIN units u ON u.id = l.unit_id
            JOIN properties p ON p.id = u.property_id
            WHERE p.owner_id = auth.uid()
            OR p.id IN (SELECT property_id FROM property_managers WHERE manager_id = auth.uid())
        )
    );

-- Tenants can view their own payments
CREATE POLICY "Tenants can view own payments"
    ON payments FOR SELECT
    USING (
        lease_id IN (
            SELECT lt.lease_id
            FROM lease_tenants lt
            JOIN tenants t ON t.id = lt.tenant_id
            WHERE t.user_id = auth.uid()
        )
    );

-- Owners/Managers can manage payments
CREATE POLICY "Owners/Managers can manage payments"
    ON payments FOR ALL
    USING (
        lease_id IN (
            SELECT l.id FROM leases l
            JOIN units u ON u.id = l.unit_id
            JOIN properties p ON p.id = u.property_id
            WHERE p.owner_id = auth.uid()
            OR p.id IN (SELECT property_id FROM property_managers WHERE manager_id = auth.uid())
        )
    );

-- =====================================================
-- MAINTENANCE REQUESTS POLICIES
-- =====================================================

-- Owners/Managers can view maintenance requests
CREATE POLICY "Owners/Managers can view maintenance"
    ON maintenance_requests FOR SELECT
    USING (
        unit_id IN (
            SELECT u.id FROM units u
            JOIN properties p ON p.id = u.property_id
            WHERE p.owner_id = auth.uid()
            OR p.id IN (SELECT property_id FROM property_managers WHERE manager_id = auth.uid())
        )
    );

-- Tenants can view their own maintenance requests
CREATE POLICY "Tenants can view own maintenance"
    ON maintenance_requests FOR SELECT
    USING (
        tenant_id IN (
            SELECT id FROM tenants WHERE user_id = auth.uid()
        )
    );

-- Tenants can create maintenance requests for their units
CREATE POLICY "Tenants can create maintenance requests"
    ON maintenance_requests FOR INSERT
    WITH CHECK (
        unit_id IN (
            SELECT l.unit_id
            FROM leases l
            JOIN lease_tenants lt ON lt.lease_id = l.id
            JOIN tenants t ON t.id = lt.tenant_id
            WHERE t.user_id = auth.uid()
            AND l.status = 'active'
        )
        AND
        tenant_id IN (
            SELECT id FROM tenants WHERE user_id = auth.uid()
        )
    );

-- Owners/Managers can manage maintenance requests
CREATE POLICY "Owners/Managers can manage maintenance"
    ON maintenance_requests FOR ALL
    USING (
        unit_id IN (
            SELECT u.id FROM units u
            JOIN properties p ON p.id = u.property_id
            WHERE p.owner_id = auth.uid()
            OR p.id IN (SELECT property_id FROM property_managers WHERE manager_id = auth.uid())
        )
    );

-- =====================================================
-- MAINTENANCE IMAGES POLICIES
-- =====================================================

CREATE POLICY "Users can view maintenance images"
    ON maintenance_images FOR SELECT
    USING (
        maintenance_request_id IN (
            SELECT id FROM maintenance_requests
            -- RLS already applied via maintenance_requests policies
        )
    );

CREATE POLICY "Users can manage maintenance images"
    ON maintenance_images FOR ALL
    USING (
        maintenance_request_id IN (
            SELECT id FROM maintenance_requests
            -- RLS already applied via maintenance_requests policies
        )
    );

-- =====================================================
-- DOCUMENTS POLICIES
-- =====================================================

-- Owners/Managers can view documents
CREATE POLICY "Owners/Managers can view documents"
    ON documents FOR SELECT
    USING (
        property_id IN (
            SELECT id FROM properties
            WHERE owner_id = auth.uid()
            OR id IN (SELECT property_id FROM property_managers WHERE manager_id = auth.uid())
        )
        OR unit_id IN (
            SELECT u.id FROM units u
            JOIN properties p ON p.id = u.property_id
            WHERE p.owner_id = auth.uid()
            OR p.id IN (SELECT property_id FROM property_managers WHERE manager_id = auth.uid())
        )
        OR lease_id IN (
            SELECT l.id FROM leases l
            JOIN units u ON u.id = l.unit_id
            JOIN properties p ON p.id = u.property_id
            WHERE p.owner_id = auth.uid()
            OR p.id IN (SELECT property_id FROM property_managers WHERE manager_id = auth.uid())
        )
    );

-- Tenants can view their documents
CREATE POLICY "Tenants can view own documents"
    ON documents FOR SELECT
    USING (
        lease_id IN (
            SELECT lt.lease_id
            FROM lease_tenants lt
            JOIN tenants t ON t.id = lt.tenant_id
            WHERE t.user_id = auth.uid()
        )
        OR tenant_id IN (
            SELECT id FROM tenants WHERE user_id = auth.uid()
        )
    );

-- Owners/Managers can manage documents
CREATE POLICY "Owners/Managers can manage documents"
    ON documents FOR ALL
    USING (
        property_id IN (
            SELECT id FROM properties
            WHERE owner_id = auth.uid()
            OR id IN (SELECT property_id FROM property_managers WHERE manager_id = auth.uid())
        )
        OR unit_id IN (
            SELECT u.id FROM units u
            JOIN properties p ON p.id = u.property_id
            WHERE p.owner_id = auth.uid()
            OR p.id IN (SELECT property_id FROM property_managers WHERE manager_id = auth.uid())
        )
        OR lease_id IN (
            SELECT l.id FROM leases l
            JOIN units u ON u.id = l.unit_id
            JOIN properties p ON p.id = u.property_id
            WHERE p.owner_id = auth.uid()
            OR p.id IN (SELECT property_id FROM property_managers WHERE manager_id = auth.uid())
        )
    );

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Auth user lookup
CREATE INDEX idx_profiles_auth_id ON profiles(id);

-- Common query patterns
CREATE INDEX idx_leases_active ON leases(status) WHERE status = 'active';
CREATE INDEX idx_payments_overdue ON payments(status) WHERE status = 'overdue';
CREATE INDEX idx_maintenance_open ON maintenance_requests(status)
    WHERE status IN ('submitted', 'in_progress');

-- =====================================================
-- INITIAL DATA / SEED (Optional)
-- =====================================================

-- Example: Insert default categories or reference data
-- Uncomment and modify as needed

-- =====================================================
-- HELPER VIEWS (Optional)
-- =====================================================

-- Active leases with tenant info
CREATE VIEW active_leases_view AS
SELECT
    l.*,
    u.unit_number,
    u.property_id,
    p.name as property_name,
    json_agg(
        json_build_object(
            'id', t.id,
            'name', t.first_name || ' ' || t.last_name,
            'email', t.email,
            'phone', t.phone,
            'is_primary', lt.is_primary
        )
    ) as tenants
FROM leases l
JOIN units u ON u.id = l.unit_id
JOIN properties p ON p.id = u.property_id
JOIN lease_tenants lt ON lt.lease_id = l.id
JOIN tenants t ON t.id = lt.tenant_id
WHERE l.status = 'active'
GROUP BY l.id, u.unit_number, u.property_id, p.name;

-- Overdue payments view
CREATE VIEW overdue_payments_view AS
SELECT
    p.*,
    l.unit_id,
    u.unit_number,
    u.property_id,
    prop.name as property_name,
    CURRENT_DATE - p.due_date as days_overdue
FROM payments p
JOIN leases l ON l.id = p.lease_id
JOIN units u ON u.id = l.unit_id
JOIN properties prop ON prop.id = u.property_id
WHERE p.status IN ('overdue', 'pending')
AND p.due_date < CURRENT_DATE
ORDER BY p.due_date;
