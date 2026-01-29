'use client';

import Link from 'next/link';
import { Home, MapPin, Bed, Bath, Square } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { UnitStatus } from '@/types';

interface UnitCardProps {
  unit: {
    id: string;
    unit_number: string;
    monthly_rent: number;
    bedrooms?: number;
    bathrooms?: number;
    square_feet?: number;
    status: UnitStatus;
    property: {
      id: string;
      name: string;
      address_line1: string;
      city: string;
      state: string;
    };
  };
}

const statusConfig: Record<UnitStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }> = {
  available: { label: 'Available', variant: 'success' },
  occupied: { label: 'Occupied', variant: 'primary' as 'default' },
  maintenance: { label: 'Maintenance', variant: 'warning' },
  unavailable: { label: 'Unavailable', variant: 'danger' },
};

export function UnitCard({ unit }: UnitCardProps) {
  const statusInfo = statusConfig[unit.status];

  return (
    <Link href={`/units/${unit.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
        <div className="aspect-video w-full overflow-hidden bg-gray-100 flex items-center justify-center">
          <Home className="h-16 w-16 text-gray-300" />
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-lg text-gray-900">
              Unit {unit.unit_number}
            </h3>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="line-clamp-1">{unit.property.name}</span>
          </div>

          <div className="text-xs text-gray-500 mb-3 line-clamp-1">
            {unit.property.address_line1}, {unit.property.city}, {unit.property.state}
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
            {unit.bedrooms !== undefined && unit.bedrooms !== null && (
              <div className="flex items-center gap-1">
                <Bed className="h-4 w-4" />
                <span>{unit.bedrooms}</span>
              </div>
            )}
            {unit.bathrooms !== undefined && unit.bathrooms !== null && (
              <div className="flex items-center gap-1">
                <Bath className="h-4 w-4" />
                <span>{unit.bathrooms}</span>
              </div>
            )}
            {unit.square_feet && (
              <div className="flex items-center gap-1">
                <Square className="h-4 w-4" />
                <span>{unit.square_feet} sqft</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 text-lg font-semibold text-gray-900">
            <span>{formatCurrency(unit.monthly_rent)}</span>
            <span className="text-sm font-normal text-gray-500">/mo</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
