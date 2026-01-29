'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Home } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { UnitCard } from '@/components/units/unit-card';
import { UnitForm } from '@/components/units/unit-form';
import { EmptyState } from '@/components/ui/empty-state';
import { getAllUnits, UnitFilters, UnitWithProperty } from '@/lib/actions/units';
import { getProperties } from '@/lib/actions/properties';
import { Property, UnitStatus } from '@/types';

export default function UnitsPage() {
  const [units, setUnits] = useState<UnitWithProperty[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const fetchUnits = async () => {
    setIsLoading(true);
    const filters: UnitFilters = {};

    if (searchQuery) {
      filters.search = searchQuery;
    }
    if (statusFilter) {
      filters.status = statusFilter as UnitStatus;
    }
    if (propertyFilter) {
      filters.propertyId = propertyFilter;
    }

    const result = await getAllUnits(filters);

    if (result.data && Array.isArray(result.data)) {
      setUnits(result.data as UnitWithProperty[]);
    }
    setIsLoading(false);
  };

  const fetchProperties = async () => {
    const result = await getProperties();
    if (result.data && Array.isArray(result.data)) {
      setProperties(result.data);
    }
  };

  useEffect(() => {
    fetchProperties();
    fetchUnits();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchUnits();
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery, statusFilter, propertyFilter]);

  const propertyOptions = [
    { value: '', label: 'All Properties' },
    ...properties.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Units</h1>
            <p className="text-gray-600 mt-1">Manage all your rental units</p>
          </div>
          <Button onClick={() => setIsFormOpen(true)} disabled={properties.length === 0}>
            <Plus className="h-4 w-4" />
            Add Unit
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1">
            <Input
              placeholder="Search units..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select
            options={propertyOptions}
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
          />
          <Select
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'available', label: 'Available' },
              { value: 'occupied', label: 'Occupied' },
              { value: 'maintenance', label: 'Maintenance' },
              { value: 'unavailable', label: 'Unavailable' },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>

        {/* Units Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-72 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : units.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {units.map((unit) => (
              <UnitCard key={unit.id} unit={unit} />
            ))}
          </div>
        ) : properties.length === 0 ? (
          <EmptyState
            icon={<Home className="h-10 w-10" />}
            title="No properties yet"
            description="You need to add a property before you can create units."
            action={{
              label: 'Add Property',
              onClick: () => window.location.href = '/properties',
            }}
          />
        ) : (
          <EmptyState
            icon={<Home className="h-10 w-10" />}
            title="No units found"
            description="Get started by adding your first unit to a property."
            action={{
              label: 'Add Unit',
              onClick: () => setIsFormOpen(true),
            }}
          />
        )}
      </div>

      {/* Unit Form Modal */}
      <UnitForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        properties={properties}
        onSuccess={fetchUnits}
      />
    </DashboardLayout>
  );
}
