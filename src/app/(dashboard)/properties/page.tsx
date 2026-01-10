'use client';

import { useState } from 'react';
import { Plus, Search, Building2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PropertyCard } from '@/components/properties/property-card';
import { EmptyState } from '@/components/ui/empty-state';

// Mock data - replace with actual data fetching
const mockProperties = [
  {
    id: '1',
    name: 'Sunset Apartments',
    address_line1: '123 Main Street',
    city: 'Los Angeles',
    state: 'CA',
    property_type: 'residential' as const,
    total_units: 24,
    image_url: undefined,
  },
  {
    id: '2',
    name: 'Downtown Plaza',
    address_line1: '456 Commerce Blvd',
    city: 'San Francisco',
    state: 'CA',
    property_type: 'commercial' as const,
    total_units: 12,
    image_url: undefined,
  },
];

export default function PropertiesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyType, setPropertyType] = useState('');

  const properties = mockProperties;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Properties</h1>
            <p className="text-gray-600 mt-1">Manage all your properties</p>
          </div>
          <Button>
            <Plus className="h-4 w-4" />
            Add Property
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1">
            <Input
              placeholder="Search properties..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select
            options={[
              { value: 'residential', label: 'Residential' },
              { value: 'commercial', label: 'Commercial' },
              { value: 'mixed_use', label: 'Mixed Use' },
            ]}
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
          />
        </div>

        {/* Properties Grid */}
        {properties.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Building2 className="h-10 w-10" />}
            title="No properties found"
            description="Get started by adding your first property to the system."
            action={{
              label: 'Add Property',
              onClick: () => console.log('Add property'),
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
