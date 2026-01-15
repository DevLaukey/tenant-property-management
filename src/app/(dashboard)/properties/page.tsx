'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Building2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PropertyCard } from '@/components/properties/property-card';
import { PropertyForm } from '@/components/properties/property-form';
import { EmptyState } from '@/components/ui/empty-state';
import { getProperties, PropertyFilters } from '@/lib/actions/properties';
import { Property, PropertyType } from '@/types';

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const fetchProperties = async () => {
    setIsLoading(true);
    const filters: PropertyFilters = {};

    if (searchQuery) {
      filters.search = searchQuery;
    }
    if (propertyType) {
      filters.propertyType = propertyType as PropertyType;
    }

    const result = await getProperties(filters);

    if (result.data && Array.isArray(result.data)) {
      setProperties(result.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchProperties();
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery, propertyType]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Properties</h1>
            <p className="text-gray-600 mt-1">Manage all your properties</p>
          </div>
          <Button onClick={() => setIsFormOpen(true)}>
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
              { value: '', label: 'All Types' },
              { value: 'residential', label: 'Residential' },
              { value: 'commercial', label: 'Commercial' },
              { value: 'mixed_use', label: 'Mixed Use' },
            ]}
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
          />
        </div>

        {/* Properties Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : properties.length > 0 ? (
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
              onClick: () => setIsFormOpen(true),
            }}
          />
        )}
      </div>

      {/* Property Form Modal */}
      <PropertyForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={fetchProperties}
      />
    </DashboardLayout>
  );
}
