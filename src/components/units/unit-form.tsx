'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { createUnit, updateUnit } from '@/lib/actions/units';
import { Unit, Property, UnitStatus } from '@/types';

interface UnitFormProps {
  isOpen: boolean;
  onClose: () => void;
  unit?: Unit;
  propertyId?: string;
  properties?: Pick<Property, 'id' | 'name'>[];
  onSuccess?: () => void;
}

const statusOptions = [
  { value: 'available', label: 'Available' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'unavailable', label: 'Unavailable' },
];

export function UnitForm({ isOpen, onClose, unit, propertyId, properties, onSuccess }: UnitFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState(propertyId || unit?.property_id || '');

  const isEditing = !!unit;

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    setIsLoading(true);

    const targetPropertyId = selectedPropertyId || propertyId || unit?.property_id;

    if (!targetPropertyId) {
      setError('Please select a property');
      setIsLoading(false);
      return;
    }

    const result = isEditing
      ? await updateUnit(unit.id, targetPropertyId, formData)
      : await createUnit(targetPropertyId, formData);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      setIsLoading(false);
      onSuccess?.();
      onClose();
    }
  };

  const propertyOptions = properties?.map((p) => ({
    value: p.id,
    label: p.name,
  })) || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Unit' : 'Add Unit'}
      description={isEditing ? 'Update unit details' : 'Add a new unit to a property'}
      size="lg"
    >
      <form action={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-md bg-red-50 text-red-600 text-sm">
            {error}
          </div>
        )}

        {!propertyId && properties && properties.length > 0 && (
          <Select
            label="Property"
            name="propertyId"
            options={propertyOptions}
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            required
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Unit Number"
            name="unitNumber"
            placeholder="e.g., 101, A1"
            defaultValue={unit?.unit_number}
            required
          />
          <Input
            label="Floor"
            name="floor"
            type="number"
            placeholder="e.g., 1"
            defaultValue={unit?.floor?.toString() || ''}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Bedrooms"
            name="bedrooms"
            type="number"
            step="0.5"
            placeholder="e.g., 2"
            defaultValue={unit?.bedrooms?.toString() || ''}
          />
          <Input
            label="Bathrooms"
            name="bathrooms"
            type="number"
            step="0.5"
            placeholder="e.g., 1.5"
            defaultValue={unit?.bathrooms?.toString() || ''}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Square Feet"
            name="squareFeet"
            type="number"
            placeholder="e.g., 850"
            defaultValue={unit?.square_feet?.toString() || ''}
          />
          <Select
            label="Status"
            name="status"
            options={statusOptions}
            defaultValue={unit?.status || 'available'}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Monthly Rent"
            name="monthlyRent"
            type="number"
            step="0.01"
            placeholder="e.g., 1500.00"
            defaultValue={unit?.monthly_rent?.toString() || ''}
            required
          />
          <Input
            label="Security Deposit"
            name="securityDeposit"
            type="number"
            step="0.01"
            placeholder="e.g., 1500.00"
            defaultValue={unit?.security_deposit?.toString() || ''}
          />
        </div>

        <Textarea
          label="Description"
          name="description"
          placeholder="Describe the unit, features, etc."
          rows={3}
          defaultValue={unit?.description || ''}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {isEditing ? 'Save Changes' : 'Add Unit'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
