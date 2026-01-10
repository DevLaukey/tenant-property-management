'use client';

import { ArrowLeft, Edit, MapPin, Plus } from 'lucide-react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Mock data - replace with actual data fetching
const mockProperty = {
  id: '1',
  name: 'Sunset Apartments',
  address_line1: '123 Main Street',
  address_line2: 'Suite 100',
  city: 'Los Angeles',
  state: 'CA',
  zip_code: '90001',
  property_type: 'residential' as const,
  total_units: 24,
  description: 'A beautiful apartment complex with modern amenities and convenient location.',
};

const mockUnits = [
  {
    id: '1',
    unit_number: '101',
    bedrooms: 2,
    bathrooms: 1,
    square_feet: 850,
    monthly_rent: 1500,
    status: 'occupied' as const,
  },
  {
    id: '2',
    unit_number: '102',
    bedrooms: 1,
    bathrooms: 1,
    square_feet: 650,
    monthly_rent: 1200,
    status: 'available' as const,
  },
  {
    id: '3',
    unit_number: '201',
    bedrooms: 2,
    bathrooms: 2,
    square_feet: 950,
    monthly_rent: 1800,
    status: 'maintenance' as const,
  },
];

export default function PropertyDetailPage({ params }: { params: { id: string } }) {
  const property = mockProperty;
  const units = mockUnits;

  const statusColors = {
    available: 'success' as const,
    occupied: 'primary' as const,
    maintenance: 'warning' as const,
    unavailable: 'danger' as const,
  };

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
          <Button variant="outline">
            <Edit className="h-4 w-4" />
            Edit Property
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
              <CardTitle className="text-base">Occupancy Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {Math.round((1 / units.length) * 100)}%
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

        {/* Units */}
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
                {units.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium">{unit.unit_number}</TableCell>
                    <TableCell>
                      {unit.bedrooms} / {unit.bathrooms}
                    </TableCell>
                    <TableCell>{unit.square_feet} sq ft</TableCell>
                    <TableCell>${unit.monthly_rent}/mo</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[unit.status]} className="capitalize">
                        {unit.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/units/${unit.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
