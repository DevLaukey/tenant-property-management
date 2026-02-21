'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { updatePayment } from '@/lib/actions/payments';
import { PaymentWithDetails } from '@/lib/actions/payments';

interface EditPaymentFormProps {
  isOpen: boolean;
  onClose: () => void;
  payment: PaymentWithDetails;
  onSuccess?: () => void;
}

const paymentMethodOptions = [
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'bank_transfer', label: 'Bank Transfer (EFT/RTGS)' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
];

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
];

const referenceConfig: Record<string, { label: string; placeholder: string }> = {
  mpesa: { label: 'M-Pesa Transaction Code', placeholder: 'e.g. QA123XYZ456' },
  bank_transfer: { label: 'Bank Reference / Transaction ID', placeholder: 'e.g. FBK20240101001' },
  cash: { label: 'Receipt Number (optional)', placeholder: 'e.g. REC-001' },
  cheque: { label: 'Cheque Number', placeholder: 'e.g. 000123' },
};

export function EditPaymentForm({ isOpen, onClose, payment, onSuccess }: EditPaymentFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(payment.status);
  const [paymentMethod, setPaymentMethod] = useState(payment.payment_method ?? 'mpesa');

  const isPaid = status === 'paid';
  const refConfig = referenceConfig[paymentMethod] ?? referenceConfig.mpesa;

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    setIsLoading(true);
    const result = await updatePayment(payment.id, formData);
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
      title="Edit Payment"
      description={`${payment.tenant_name} — ${payment.property_name}${payment.unit_number ? `, Unit ${payment.unit_number}` : ''}`}
      size="lg"
    >
      <form action={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 rounded-md bg-red-50 text-red-600 text-sm">{error}</div>
        )}

        {/* Amount + Due Date */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Amount (Ksh)"
            name="amount"
            type="number"
            step="0.01"
            defaultValue={payment.amount.toString()}
            required
          />
          <Input
            label="Due Date"
            name="dueDate"
            type="date"
            defaultValue={payment.due_date}
            required
          />
        </div>

        {/* Status */}
        <Select
          label="Status"
          name="status"
          options={statusOptions}
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        />

        {/* Paid fields — shown only when status is paid */}
        {isPaid && (
          <div className="space-y-4 border-t pt-4">
            <p className="text-sm font-medium text-gray-700">Payment Details</p>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Date Received"
                name="paidDate"
                type="date"
                defaultValue={payment.paid_date ?? new Date().toISOString().split('T')[0]}
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
              label={refConfig.label}
              name="transactionReference"
              placeholder={refConfig.placeholder}
              defaultValue={payment.transaction_reference ?? ''}
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
          defaultValue={payment.notes ?? ''}
          placeholder="Any additional notes..."
          rows={2}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
