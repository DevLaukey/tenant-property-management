'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { createLease, updateLease, LeaseWithDetails } from '@/lib/actions/leases';
import { UnitWithProperty } from '@/lib/actions/units';
import { TenantWithLease } from '@/lib/actions/tenants';

interface LeaseFormProps {
  isOpen: boolean;
  onClose: () => void;
  lease?: LeaseWithDetails;
  availableUnits?: UnitWithProperty[];
  tenants?: TenantWithLease[];
  onSuccess?: () => void;
}

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'expired', label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
];

const dueDayOptions = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}${[1, 21].includes(i + 1) ? 'st' : [2, 22].includes(i + 1) ? 'nd' : [3, 23].includes(i + 1) ? 'rd' : 'th'} of each month`,
}));

export function LeaseForm({
  isOpen,
  onClose,
  lease,
  availableUnits = [],
  tenants = [],
  onSuccess,
}: LeaseFormProps) {
  const isEditing = !!lease;
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const unitOptions = availableUnits.map((u) => ({
    value: u.id,
    label: `${u.property.name} — Unit ${u.unit_number} (Ksh ${u.monthly_rent.toLocaleString()}/mo)`,
  }));

  const tenantOptions = tenants.map((t) => ({
    value: t.id,
    label: `${t.first_name} ${t.last_name}${t.current_unit ? ` (Unit ${t.current_unit})` : ''}`,
  }));

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    setIsLoading(true);

    const result = isEditing
      ? await updateLease(lease.id, formData)
      : await createLease(formData);

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
      title={isEditing ? 'Edit Lease' : 'New Lease'}
      description={
        isEditing
          ? `${lease.tenant_name} — ${lease.property_name}${lease.unit?.unit_number ? `, Unit ${lease.unit.unit_number}` : ''}`
          : 'Create a lease agreement and assign a unit to a tenant'
      }
      size="lg"
    >
      <form action={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 rounded-md bg-red-50 text-red-600 text-sm">{error}</div>
        )}

        {/* Create-only: unit + tenant selectors */}
        {!isEditing && (
          <>
            <Select
              label="Unit"
              name="unitId"
              options={unitOptions}
              required
            />
            <Select
              label="Tenant (optional — assign later if needed)"
              name="tenantId"
              options={tenantOptions}
            />
          </>
        )}

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Start Date"
            name="startDate"
            type="date"
            defaultValue={lease?.start_date ?? ''}
            required
          />
          <Input
            label="End Date"
            name="endDate"
            type="date"
            defaultValue={lease?.end_date ?? ''}
            required
          />
        </div>

        {/* Rent + deposit */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Monthly Rent (Ksh)"
            name="monthlyRent"
            type="number"
            step="0.01"
            defaultValue={lease?.monthly_rent?.toString() ?? ''}
            placeholder="e.g. 15000"
            required
          />
          <Input
            label="Security Deposit (Ksh)"
            name="securityDeposit"
            type="number"
            step="0.01"
            defaultValue={lease?.security_deposit?.toString() ?? ''}
            placeholder="Optional"
          />
        </div>

        {/* Due day + status */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Rent Due Day"
            name="dueDay"
            options={dueDayOptions}
            defaultValue={lease?.due_day?.toString() ?? '1'}
          />
          {isEditing && (
            <Select
              label="Status"
              name="status"
              options={statusOptions}
              defaultValue={lease.status}
            />
          )}
        </div>

        <Textarea
          label="Notes (optional)"
          name="notes"
          defaultValue={lease?.notes ?? ''}
          placeholder="e.g. Includes parking, pet allowed..."
          rows={2}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {isEditing ? 'Save Changes' : 'Create Lease'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
