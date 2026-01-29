'use client';

import { useState, useEffect, use } from 'react';
import { ArrowLeft, Edit, MapPin, Trash2, Home, Bed, Bath, Square, Building } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UnitForm } from '@/components/units/unit-form';
import { getUnit, deleteUnit, UnitWithProperty } from '@/lib/actions/units';
import { UnitStatus } from '@/types';
import { formatCurrency } from '@/lib/utils';

const statusConfig: Record<UnitStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }> = {
  available: { label: 'Available', variant: 'success' },
  occupied: { label: 'Occupied', variant: 'default' },
  maintenance: { label: 'Maintenance', variant: 'warning' },
  unavailable: { label: 'Unavailable', variant: 'danger' },
};

export default function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [unit, setUnit] = useState<UnitWithProperty | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUnit = async () => {
    setIsLoading(true);
    const result = await getUnit(id);

    if (result.data && !Array.isArray(result.data)) {
      setUnit(result.data as UnitWithProperty);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUnit();
  }, [id]);

  const handleDelete = async () => {
    if (!unit) return;
    if (!confirm('Are you sure you want to delete this unit?')) return;

    setIsDeleting(true);
    const result = await deleteUnit(id, unit.property_id);

    if (result.success) {
      router.push('/units');
    } else {
      alert(result.error || 'Failed to delete unit');
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="h-12 w-64 bg-gray-100 animate-pulse rounded" />
          <div className="grid gap-6 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-xl" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!unit) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900">Unit not found</h2>
          <p className="text-gray-600 mt-2">The unit you're looking for doesn't exist.</p>
          <Link href="/units">
            <Button className="mt-4">Back to Units</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const statusInfo = statusConfig[unit.status];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/units">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">Unit {unit.unit_number}</h1>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
            <Link href={`/properties/${unit.property.id}`} className="flex items-center gap-2 text-gray-600 mt-1 hover:text-gray-900">
              <MapPin className="h-4 w-4" />
              <span>
                {unit.property.name} - {unit.property.address_line1}, {unit.property.city}, {unit.property.state}
              </span>
            </Link>
          </div>
          <Button variant="outline" onClick={() => setIsEditOpen(true)}>
            <Edit className="h-4 w-4" />
            Edit Unit
          </Button>
          <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>

        {/* Unit Info Cards */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bed className="h-4 w-4" />
                Bedrooms
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{unit.bedrooms ?? 'N/A'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bath className="h-4 w-4" />
                Bathrooms
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{unit.bathrooms ?? 'N/A'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Square className="h-4 w-4" />
                Square Feet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{unit.square_feet ? `${unit.square_feet}` : 'N/A'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building className="h-4 w-4" />
                Floor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{unit.floor ?? 'N/A'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Financial Info */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Rent</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(unit.monthly_rent)}</p>
              <p className="text-sm text-gray-500">per month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security Deposit</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {unit.security_deposit ? formatCurrency(unit.security_deposit) : 'Not set'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Property Link */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Property
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href={`/properties/${unit.property.id}`} className="block hover:bg-gray-50 -m-2 p-2 rounded-lg">
              <p className="font-semibold text-lg text-gray-900">{unit.property.name}</p>
              <p className="text-gray-600">
                {unit.property.address_line1}, {unit.property.city}, {unit.property.state}
              </p>
            </Link>
          </CardContent>
        </Card>

        {/* Description */}
        {unit.description && (
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">{unit.description}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Unit Modal */}
      <UnitForm
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        unit={unit}
        propertyId={unit.property_id}
        onSuccess={fetchUnit}
      />
    </DashboardLayout>
  );
}
