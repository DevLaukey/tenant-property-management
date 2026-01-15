'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { createProperty, updateProperty } from '@/lib/actions/properties';
import { Property } from '@/types';

interface PropertyFormProps {
  isOpen: boolean;
  onClose: () => void;
  property?: Property;
  onSuccess?: () => void;
}

export function PropertyForm({ isOpen, onClose, property, onSuccess }: PropertyFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isEditing = !!property;

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    setIsLoading(true);

    const result = isEditing
      ? await updateProperty(property.id, formData)
      : await createProperty(formData);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      setIsLoading(false);
      onSuccess?.();
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Property' : 'Add Property'}
      description={isEditing ? 'Update property details' : 'Add a new property to your portfolio'}
      size="lg"
    >
      <form action={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-md bg-red-50 text-red-600 text-sm">
            {error}
          </div>
        )}

        <Input
          label="Property Name"
          name="name"
          placeholder="e.g., Sunset Apartments"
          defaultValue={property?.name}
          required
        />

        <Select
          label="Property Type"
          name="propertyType"
          options={[
            { value: 'residential', label: 'Residential' },
            { value: 'commercial', label: 'Commercial' },
            { value: 'mixed_use', label: 'Mixed Use' },
          ]}
          defaultValue={property?.property_type}
          required
        />

        <Input
          label="Street Address"
          name="addressLine1"
          placeholder="123 Main Street"
          defaultValue={property?.address_line1}
          required
        />

        <Input
          label="Address Line 2"
          name="addressLine2"
          placeholder="Suite, Unit, Building (optional)"
          defaultValue={property?.address_line2 || ''}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="City"
            name="city"
            placeholder="Los Angeles"
            defaultValue={property?.city}
            required
          />
          <Input
            label="State"
            name="state"
            placeholder="CA"
            defaultValue={property?.state}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="ZIP Code"
            name="zipCode"
            placeholder="90001"
            defaultValue={property?.zip_code}
            required
          />
          <Input
            label="Country"
            name="country"
            placeholder="USA"
            defaultValue={property?.country || 'USA'}
          />
        </div>

        <Textarea
          label="Description"
          name="description"
          placeholder="Describe the property..."
          rows={3}
          defaultValue={property?.description || ''}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {isEditing ? 'Save Changes' : 'Add Property'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
