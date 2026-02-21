'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Users, Mail, Phone, Home } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { TenantForm } from '@/components/tenants/tenant-form';
import { getTenants, TenantWithLease } from '@/lib/actions/tenants';
import { getAllUnits, UnitWithProperty } from '@/lib/actions/units';

export default function TenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantWithLease[]>([]);
  const [availableUnits, setAvailableUnits] = useState<UnitWithProperty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const fetchTenants = async () => {
    setIsLoading(true);
    const result = await getTenants(searchQuery ? { search: searchQuery } : undefined);
    if (result.data && Array.isArray(result.data)) {
      setTenants(result.data as TenantWithLease[]);
    }
    setIsLoading(false);
  };

  const fetchAvailableUnits = async () => {
    const result = await getAllUnits({ status: 'available' });
    if (result.data && Array.isArray(result.data)) {
      setAvailableUnits(result.data as UnitWithProperty[]);
    }
  };

  useEffect(() => {
    fetchTenants();
    fetchAvailableUnits();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchTenants();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const formUnits = availableUnits.map((u) => ({
    id: u.id,
    unit_number: u.unit_number,
    monthly_rent: u.monthly_rent,
    property: {
      id: u.property.id,
      name: u.property.name,
    },
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tenants</h1>
            <p className="text-gray-600 mt-1">Manage all tenant information</p>
          </div>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Tenant
          </Button>
        </div>

        {/* Search */}
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1">
            <Input
              placeholder="Search tenants by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Tenants Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : tenants.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tenants.map((tenant) => (
              <Card key={tenant.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-semibold text-lg shrink-0">
                      {tenant.first_name[0]}{tenant.last_name[0]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900 leading-tight">
                        {tenant.first_name} {tenant.last_name}
                      </h3>
                      <Badge
                        variant={tenant.lease_status === 'active' ? 'success' : 'default'}
                        className="mt-1"
                      >
                        {tenant.lease_status === 'active' ? 'Active' : 'No Lease'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="truncate">{tenant.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0" />
                    <span>{tenant.phone}</span>
                  </div>
                </div>

                {tenant.current_unit && tenant.current_property && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Home className="h-4 w-4 shrink-0 text-gray-400" />
                      <span>
                        <span className="font-medium">{tenant.current_property}</span>
                        {' — '}Unit {tenant.current_unit}
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => router.push(`/tenants/${tenant.id}`)}
                  >
                    View Details
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            title="No tenants found"
            description={
              searchQuery
                ? 'No tenants match your search. Try a different name, email, or phone number.'
                : 'Get started by adding your first tenant.'
            }
            action={
              !searchQuery
                ? { label: 'Add Tenant', onClick: () => setIsFormOpen(true) }
                : undefined
            }
          />
        )}
      </div>

      <TenantForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        availableUnits={formUnits}
        onSuccess={() => {
          fetchTenants();
          fetchAvailableUnits();
        }}
      />
    </DashboardLayout>
  );
}
