'use client';

import { useState } from 'react';
import { Smartphone, Copy, Check, Info } from 'lucide-react';

interface PaymentInstructionsProps {
  unitNumber: string;
  monthlyRent: number;
  tenantName: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="ml-2 p-1 rounded hover:bg-green-100 transition-colors text-green-600"
      title="Copy to clipboard"
      type="button"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function PaymentInstructions({ unitNumber, monthlyRent, tenantName }: PaymentInstructionsProps) {
  const paybillNumber = process.env.NEXT_PUBLIC_PAYBILL_NUMBER ?? '—';
  const accountName = process.env.NEXT_PUBLIC_PAYBILL_ACCOUNT_NAME ?? 'Family Bank';
  // Payment reference tenants enter as the M-Pesa account number
  const accountRef = `UNIT${unitNumber.replace(/\s+/g, '')}`;

  const steps = [
    { label: 'Open M-Pesa on your phone' },
    { label: 'Select', highlight: 'Lipa na M-Pesa' },
    { label: 'Select', highlight: 'Pay Bill' },
    { label: 'Business No.', value: paybillNumber },
    { label: 'Account No.', value: accountRef },
    { label: 'Amount', value: `Ksh ${monthlyRent.toLocaleString()}` },
    { label: 'Enter your M-Pesa PIN and confirm' },
  ];

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-green-600 text-white">
        <Smartphone className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold text-base">Pay via M-Pesa Paybill</p>
          <p className="text-green-100 text-sm">{accountName} · for {tenantName}</p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Key details */}
        <div className="grid grid-cols-3 gap-3">
          <Detail
            label="Paybill (Business No.)"
            value={paybillNumber}
            copyable
          />
          <Detail
            label="Account No."
            value={accountRef}
            copyable
            hint="Enter this exactly as shown"
          />
          <Detail
            label="Amount"
            value={`Ksh ${monthlyRent.toLocaleString()}`}
          />
        </div>

        {/* Step-by-step */}
        <div>
          <p className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-2">
            How to pay
          </p>
          <ol className="space-y-1.5">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-green-900">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-200 text-green-800 text-xs font-bold mt-0.5">
                  {i + 1}
                </span>
                <span>
                  {step.label}
                  {step.highlight && (
                    <> <strong className="font-semibold">{step.highlight}</strong></>
                  )}
                  {step.value && (
                    <>
                      {': '}
                      <strong className="font-mono font-semibold tracking-wide">{step.value}</strong>
                      <CopyButton text={step.value.replace('Ksh ', '').replace(/,/g, '')} />
                    </>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Note */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-green-100 text-green-800 text-xs">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <p>
            After paying, send the <strong>M-Pesa confirmation message</strong> to your landlord so the payment can be recorded in the system.
          </p>
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  copyable,
  hint,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  hint?: string;
}) {
  return (
    <div className="rounded-lg bg-white border border-green-200 px-3 py-2.5">
      <p className="text-xs text-green-700 font-medium mb-0.5">{label}</p>
      <div className="flex items-center">
        <span className="font-mono font-bold text-gray-900 text-base">{value}</span>
        {copyable && <CopyButton text={value} />}
      </div>
      {hint && <p className="text-xs text-green-600 mt-0.5">{hint}</p>}
    </div>
  );
}
