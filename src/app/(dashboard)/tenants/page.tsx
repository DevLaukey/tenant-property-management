'use client';

import { useState } from 'react';
import { Plus, Search, Users, Mail, Phone } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

// Mock data
const mockTenants = [
  {
    id: '1',
    first_name: 'John',
    last_name: 'Smith',
    email: 'john.smith@email.com',
    phone: '(555) 123-4567',
    unit_number: '101',
    property_name: 'Sunset Apartments',
    lease_status: 'active' as const,
  },
  {
    id: '2',
    first_name: 'Sarah',
    last_name: 'Johnson',
    email: 'sarah.j@email.com',
    phone: '(555) 234-5678',
    unit_number: '205',
    property_name: 'Downtown Plaza',
    lease_status: 'active' as const,
  },
  {
    id: '3',
    first_name: 'Mike',
    last_name: 'Davis',
    email: 'mike.davis@email.com',
    phone: '(555) 345-6789',
    unit_number: null,
    property_name: null,
    lease_status: 'inactive' as const,
  },
];

export default function TenantsPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const tenants = mockTenants;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tenants</h1>
            <p className="text-gray-600 mt-1">Manage all tenant information</p>
          </div>
          <Button>
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
        {tenants.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tenants.map((tenant) => (
              <Card key={tenant.id} className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-semibold text-lg">
                      {tenant.first_name[0]}
                      {tenant.last_name[0]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900">
                        {tenant.first_name} {tenant.last_name}
                      </h3>
                      <Badge
                        variant={tenant.lease_status === 'active' ? 'success' : 'default'}
                        className="mt-1"
                      >
                        {tenant.lease_status}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{tenant.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span>{tenant.phone}</span>
                  </div>
                </div>

                {tenant.unit_number && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Current Unit:</span>
                      <br />
                      {tenant.property_name} - Unit {tenant.unit_number}
                    </p>
                  </div>
                )}

                <div className="mt-4">
                  <Button variant="outline" size="sm" className="w-full">
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
            description="Get started by adding tenant information to the system."
            action={{
              label: 'Add Tenant',
              onClick: () => console.log('Add tenant'),
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
