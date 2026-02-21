'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { recordPayment } from '@/lib/actions/payments';

interface RecordPaymentFormProps {
  isOpen: boolean;
  onClose: () => void;
  paymentId: string;
  defaultAmount: number;
  tenantName: string;
  dueDate: string;
  onSuccess?: () => void;
}

const paymentMethodOptions = [
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'bank_transfer', label: 'Bank Transfer (EFT/RTGS)' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
];

const referenceConfig: Record<string, { label: string; placeholder: string; required: boolean }> = {
  mpesa: {
    label: 'M-Pesa Transaction Code',
    placeholder: 'e.g. QA123XYZ456',
    required: true,
  },
  bank_transfer: {
    label: 'Bank Reference / Transaction ID',
    placeholder: 'e.g. FBK20240101001',
    required: false,
  },
  cash: {
    label: 'Receipt Number (optional)',
    placeholder: 'e.g. REC-001',
    required: false,
  },
  cheque: {
    label: 'Cheque Number',
    placeholder: 'e.g. 000123',
    required: false,
  },
};

export function RecordPaymentForm({
  isOpen,
  onClose,
  paymentId,
  defaultAmount,
  tenantName,
  dueDate,
  onSuccess,
}: RecordPaymentFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('mpesa');

  const today = new Date().toISOString().split('T')[0];
  const refConfig = referenceConfig[paymentMethod] ?? referenceConfig.mpesa;

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    setIsLoading(true);

    const result = await recordPayment(paymentId, formData);

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
      title="Record Payment"
      description={`Confirming payment received from ${tenantName}`}
      size="md"
    >
      <form action={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-md bg-red-50 text-red-600 text-sm">{error}</div>
        )}

        <div className="p-3 rounded-lg bg-gray-50 text-sm text-gray-600">
          <span className="font-medium">Due date:</span>{' '}
          {new Date(dueDate).toLocaleDateString('en-KE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Amount (Ksh)"
            name="amount"
            type="number"
            step="0.01"
            defaultValue={defaultAmount.toString()}
            required
          />
          <Input
            label="Date Received"
            name="paidDate"
            type="date"
            defaultValue={today}
            required
          />
        </div>

        <Select
          label="Payment Method"
          name="paymentMethod"
          options={paymentMethodOptions}
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
        />

        <Input
          label={refConfig.label}
          name="transactionReference"
          placeholder={refConfig.placeholder}
          required={refConfig.required}
          helperText={
            paymentMethod === 'mpesa'
              ? 'Found in the M-Pesa confirmation SMS sent to the tenant'
              : undefined
          }
        />

        <Textarea
          label="Notes (optional)"
          name="notes"
          placeholder="Any additional notes..."
          rows={2}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Confirm Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
