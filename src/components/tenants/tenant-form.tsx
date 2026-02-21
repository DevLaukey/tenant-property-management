'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { createTenant, updateTenant } from '@/lib/actions/tenants';
import { Tenant } from '@/types';

interface AvailableUnit {
  id: string;
  unit_number: string;
  monthly_rent: number;
  property: {
    id: string;
    name: string;
  };
}

interface TenantFormProps {
  isOpen: boolean;
  onClose: () => void;
  tenant?: Tenant;
  availableUnits?: AvailableUnit[];
  onSuccess?: () => void;
}

export function TenantForm({ isOpen, onClose, tenant, availableUnits = [], onSuccess }: TenantFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [assignUnit, setAssignUnit] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState('');

  const isEditing = !!tenant;

  const selectedUnit = availableUnits.find((u) => u.id === selectedUnitId);

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    setIsLoading(true);

    if (assignUnit && selectedUnitId) {
      formData.set('unitId', selectedUnitId);
    }

    const result = isEditing
      ? await updateTenant(tenant.id, formData)
      : await createTenant(formData);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      setIsLoading(false);
      setAssignUnit(false);
      setSelectedUnitId('');
      onSuccess?.();
      onClose();
    }
  };

  const unitOptions = availableUnits.map((u) => ({
    value: u.id,
    label: `${u.property.name} — Unit ${u.unit_number} ($${u.monthly_rent.toLocaleString()}/mo)`,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Tenant' : 'Add Tenant'}
      description={isEditing ? 'Update tenant information' : 'Add a new tenant to the system'}
      size="lg"
    >
      <form action={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 rounded-md bg-red-50 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First Name"
            name="firstName"
            placeholder="e.g., John"
            defaultValue={tenant?.first_name}
            required
          />
          <Input
            label="Last Name"
            name="lastName"
            placeholder="e.g., Smith"
            defaultValue={tenant?.last_name}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Email"
            name="email"
            type="email"
            placeholder="john@example.com"
            defaultValue={tenant?.email}
            required
          />
          <Input
            label="Phone"
            name="phone"
            type="tel"
            placeholder="(555) 123-4567"
            defaultValue={tenant?.phone}
            required
          />
        </div>

        <Textarea
          label="Notes"
          name="notes"
          placeholder="Any additional notes about this tenant..."
          rows={2}
          defaultValue={tenant?.notes || ''}
        />

        {/* Unit Assignment (only when adding a new tenant) */}
        {!isEditing && (
          <div className="border-t pt-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
                checked={assignUnit}
                onChange={(e) => {
                  setAssignUnit(e.target.checked);
                  if (!e.target.checked) setSelectedUnitId('');
                }}
              />
              <span className="text-sm font-medium text-gray-700">Assign to a unit now</span>
            </label>

            {assignUnit && (
              <div className="mt-4 space-y-4">
                <Select
                  label="Unit"
                  name="unitId"
                  options={unitOptions}
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  required
                />

                {selectedUnitId && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Lease Start Date"
                        name="startDate"
                        type="date"
                        required
                      />
                      <Input
                        label="Lease End Date"
                        name="endDate"
                        type="date"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Monthly Rent ($)"
                        name="monthlyRent"
                        type="number"
                        step="0.01"
                        defaultValue={selectedUnit?.monthly_rent?.toString() || ''}
                        required
                      />
                      <Select
                        label="Rent Due Day"
                        name="dueDay"
                        options={Array.from({ length: 28 }, (_, i) => ({
                          value: String(i + 1),
                          label: `${i + 1}${[1, 21].includes(i + 1) ? 'st' : [2, 22].includes(i + 1) ? 'nd' : [3, 23].includes(i + 1) ? 'rd' : 'th'} of the month`,
                        }))}
                        defaultValue="1"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {isEditing ? 'Save Changes' : 'Add Tenant'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
