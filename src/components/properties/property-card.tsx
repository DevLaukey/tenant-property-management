import Link from 'next/link';
import { Building2, Home, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PropertyCardProps {
  property: {
    id: string;
    name: string;
    address_line1: string;
    city: string;
    state: string;
    property_type: 'residential' | 'commercial' | 'mixed_use';
    total_units: number;
    image_url?: string;
  };
}

export function PropertyCard({ property }: PropertyCardProps) {
  const typeLabels = {
    residential: 'Residential',
    commercial: 'Commercial',
    mixed_use: 'Mixed Use',
  };

  return (
    <Link href={`/properties/${property.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
        <div className="aspect-video w-full overflow-hidden bg-gray-100">
          {property.image_url ? (
            <img
              src={property.image_url}
              alt={property.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Building2 className="h-16 w-16 text-gray-300" />
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-lg text-gray-900 line-clamp-1">
              {property.name}
            </h3>
            <Badge variant="primary">{typeLabels[property.property_type]}</Badge>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
            <MapPin className="h-4 w-4" />
            <span className="line-clamp-1">
              {property.address_line1}, {property.city}, {property.state}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Home className="h-4 w-4" />
            <span>{property.total_units} units</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
