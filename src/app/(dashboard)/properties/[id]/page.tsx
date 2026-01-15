'use client';

import { useState, useEffect, use } from 'react';
import { ArrowLeft, Edit, MapPin, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PropertyForm } from '@/components/properties/property-form';
import { getProperty, deleteProperty } from '@/lib/actions/properties';
import { Property } from '@/types';

export default function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [property, setProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProperty = async () => {
    setIsLoading(true);
    const result = await getProperty(id);

    if (result.data && !Array.isArray(result.data)) {
      setProperty(result.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchProperty();
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this property?')) return;

    setIsDeleting(true);
    const result = await deleteProperty(id);

    if (result.success) {
      router.push('/properties');
    } else {
      alert(result.error || 'Failed to delete property');
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="h-12 w-64 bg-gray-100 animate-pulse rounded" />
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-xl" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!property) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900">Property not found</h2>
          <p className="text-gray-600 mt-2">The property you're looking for doesn't exist.</p>
          <Link href="/properties">
            <Button className="mt-4">Back to Properties</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/properties">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{property.name}</h1>
            <div className="flex items-center gap-2 text-gray-600 mt-1">
              <MapPin className="h-4 w-4" />
              <span>
                {property.address_line1}, {property.city}, {property.state} {property.zip_code}
              </span>
            </div>
          </div>
          <Button variant="outline" onClick={() => setIsEditOpen(true)}>
            <Edit className="h-4 w-4" />
            Edit Property
          </Button>
          <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>

        {/* Property Info */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Property Type</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="primary" className="capitalize">
                {property.property_type.replace('_', ' ')}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Total Units</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{property.total_units}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Location</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                {property.city}, {property.state}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Description */}
        {property.description && (
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">{property.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Units Placeholder */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Units</CardTitle>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Add Unit
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit #</TableHead>
                  <TableHead>Bed/Bath</TableHead>
                  <TableHead>Sq Ft</TableHead>
                  <TableHead>Rent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No units added yet. Click "Add Unit" to get started.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Edit Property Modal */}
      <PropertyForm
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        property={property}
        onSuccess={fetchProperty}
      />
    </DashboardLayout>
  );
}
