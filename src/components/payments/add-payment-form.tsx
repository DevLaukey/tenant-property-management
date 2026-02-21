'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { createPayment } from '@/lib/actions/payments';
import { LeaseWithDetails } from '@/lib/actions/leases';

interface AddPaymentFormProps {
  isOpen: boolean;
  onClose: () => void;
  leases: LeaseWithDetails[];
  onSuccess?: () => void;
}

const paymentMethodOptions = [
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'bank_transfer', label: 'Bank Transfer (EFT/RTGS)' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
];

export function AddPaymentForm({ isOpen, onClose, leases, onSuccess }: AddPaymentFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLeaseId, setSelectedLeaseId] = useState('');
  const [markPaid, setMarkPaid] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('mpesa');

  const today = new Date().toISOString().split('T')[0];

  const selectedLease = leases.find((l) => l.id === selectedLeaseId);

  const leaseOptions = leases.map((l) => ({
    value: l.id,
    label: `${l.tenant_name} — ${l.property_name}, Unit ${l.unit?.unit_number} (Ksh ${l.monthly_rent.toLocaleString()}/mo)`,
  }));

  const refLabel =
    paymentMethod === 'mpesa'
      ? 'M-Pesa Transaction Code'
      : paymentMethod === 'cheque'
      ? 'Cheque Number'
      : 'Transaction Reference';

  const refPlaceholder =
    paymentMethod === 'mpesa'
      ? 'e.g. QA123XYZ456'
      : paymentMethod === 'cheque'
      ? 'e.g. 000123'
      : 'e.g. FBK20240201001';

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    setIsLoading(true);

    formData.set('status', markPaid ? 'paid' : 'pending');

    const result = await createPayment(formData);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      setIsLoading(false);
      // reset
      setSelectedLeaseId('');
      setMarkPaid(true);
      setPaymentMethod('mpesa');
      onSuccess?.();
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Payment"
      description="Record a rent payment against an active lease"
      size="lg"
    >
      <form action={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 rounded-md bg-red-50 text-red-600 text-sm">{error}</div>
        )}

        {/* Lease selector */}
        <Select
          label="Tenant / Lease"
          name="leaseId"
          options={leaseOptions}
          value={selectedLeaseId}
          onChange={(e) => setSelectedLeaseId(e.target.value)}
          required
        />

        {/* Amount + due date */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Amount (Ksh)"
            name="amount"
            type="number"
            step="0.01"
            defaultValue={selectedLease?.monthly_rent?.toString() ?? ''}
            key={selectedLeaseId} // reset when lease changes
            placeholder="e.g. 15000"
            required
          />
          <Input
            label="Due Date"
            name="dueDate"
            type="date"
            defaultValue={today}
            required
          />
        </div>

        {/* Mark as paid toggle */}
        <div className="border-t pt-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
              checked={markPaid}
              onChange={(e) => setMarkPaid(e.target.checked)}
            />
            <span className="text-sm font-medium text-gray-700">
              Payment already received
            </span>
          </label>
        </div>

        {/* Payment details — shown only when marking as paid */}
        {markPaid && (
          <div className="space-y-4 pl-7">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Date Received"
                name="paidDate"
                type="date"
                defaultValue={today}
                required
              />
              <Select
                label="Payment Method"
                name="paymentMethod"
                options={paymentMethodOptions}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
            </div>

            <Input
              label={refLabel}
              name="transactionReference"
              placeholder={refPlaceholder}
              required={paymentMethod === 'mpesa'}
              helperText={
                paymentMethod === 'mpesa'
                  ? 'From the M-Pesa confirmation SMS'
                  : undefined
              }
            />
          </div>
        )}

        <Textarea
          label="Notes (optional)"
          name="notes"
          placeholder="e.g. Partial payment, short by Ksh 500..."
          rows={2}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {markPaid ? 'Record Payment' : 'Add as Pending'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
