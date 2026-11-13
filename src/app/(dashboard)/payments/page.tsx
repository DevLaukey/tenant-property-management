'use client';

import { useState, useEffect, useCallback } from 'react';
import { Banknote, AlertCircle, TrendingUp, CheckCircle, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RecordPaymentForm } from '@/components/payments/record-payment-form';
import { AddPaymentForm } from '@/components/payments/add-payment-form';
import { EditPaymentForm } from '@/components/payments/edit-payment-form';
import {
  getPayments,
  getPaymentStats,
  deletePayment,
  PaymentWithDetails,
  PaymentStats,
} from '@/lib/actions/payments';
import { getLeases, LeaseWithDetails } from '@/lib/actions/leases';
import {
  getUnmatchedBankTransactions,
  syncEquityNow,
  isEquitySyncAvailable,
  BankTransaction,
} from '@/lib/actions/bank-payments';
import { PaymentStatus } from '@/types';

const statusColors = {
  paid: 'success' as const,
  partial: 'warning' as const,
  overdue: 'danger' as const,
  pending: 'default' as const,
};

const methodLabels: Record<string, string> = {
  mpesa: 'M-Pesa',
  equity_bank: 'Equity Bank',
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  cheque: 'Cheque',
  check: 'Cheque',
  online: 'Online',
  mobile_money: 'Mobile Money',
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [activeLeases, setActiveLeases] = useState<LeaseWithDetails[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [recordingPayment, setRecordingPayment] = useState<PaymentWithDetails | null>(null);
  const [editingPayment, setEditingPayment] = useState<PaymentWithDetails | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [unmatched, setUnmatched] = useState<BankTransaction[]>([]);
  const [canSync, setCanSync] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const fetchUnmatched = useCallback(async () => {
    const result = await getUnmatchedBankTransactions();
    if (result.data) setUnmatched(result.data);
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    const result = await syncEquityNow();
    if (result.error) {
      setSyncMessage({ text: result.error, isError: true });
    } else if (result.data) {
      const { matched, unmatched: notMatched, scanned } = result.data;
      setSyncMessage({
        text:
          matched + notMatched === 0
            ? `Up to date. Checked ${scanned} Equity credit${scanned === 1 ? '' : 's'}, nothing new.`
            : `Recorded ${matched} new payment${matched === 1 ? '' : 's'}` +
              (notMatched ? `, ${notMatched} could not be matched to a unit (see below).` : '.'),
        isError: false,
      });
    }
    setIsSyncing(false);
    fetchPayments();
    fetchUnmatched();
  };

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    const [paymentsResult, statsResult] = await Promise.all([
      getPayments({
        search: searchQuery || undefined,
        status: (statusFilter as PaymentStatus) || undefined,
      }),
      getPaymentStats(),
    ]);
    if (paymentsResult.data && Array.isArray(paymentsResult.data)) {
      setPayments(paymentsResult.data);
    }
    if (statsResult.data) setStats(statsResult.data);
    setIsLoading(false);
  }, [searchQuery, statusFilter]);

  const fetchLeases = useCallback(async () => {
    const result = await getLeases({ status: 'active' });
    if (result.data && Array.isArray(result.data)) {
      setActiveLeases(result.data as LeaseWithDetails[]);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
    fetchLeases();
    fetchUnmatched();
    isEquitySyncAvailable().then(setCanSync);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchPayments(), 300);
    return () => clearTimeout(t);
  }, [searchQuery, statusFilter]);

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    await deletePayment(id);
    setIsDeleting(false);
    setConfirmDeleteId(null);
    fetchPayments();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
            <p className="text-gray-600 mt-1">Track rent payments and revenue</p>
          </div>
          <div className="flex gap-2">
            {canSync && (
              <Button variant="outline" onClick={handleSync} isLoading={isSyncing}>
                {!isSyncing && <RefreshCw className="h-4 w-4" />}
                Sync Equity
              </Button>
            )}
            <Button onClick={() => setIsAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Payment
            </Button>
          </div>
        </div>

        {syncMessage && (
          <div
            className={`p-3 rounded-md text-sm ${
              syncMessage.isError ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
            }`}
          >
            {syncMessage.text}
          </div>
        )}

        {/* Equity credits that could not be matched to a unit */}
        {unmatched.length > 0 && (
          <Card className="border-amber-200">
            <div className="px-5 py-4 border-b border-amber-100 bg-amber-50 rounded-t-xl">
              <p className="font-semibold text-amber-900">
                {unmatched.length} Equity payment{unmatched.length === 1 ? '' : 's'} need attention
              </p>
              <p className="text-sm text-amber-800">
                These reached your account but the reference didn&apos;t match a tenant. Record them
                manually against the right payment.
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference used</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Bank ref</TableHead>
                  <TableHead>Problem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmatched.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono">{tx.account_reference ?? '—'}</TableCell>
                    <TableCell>
                      {tx.payer_name ?? '—'}
                      {tx.payer_phone ? (
                        <span className="block text-xs text-gray-500">{tx.payer_phone}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>Ksh {Number(tx.amount).toLocaleString()}</TableCell>
                    <TableCell>
                      {new Date(tx.paid_at ?? tx.created_at).toLocaleDateString('en-KE', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{tx.bank_reference}</TableCell>
                    <TableCell className="text-sm text-amber-800">{tx.match_error}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Stats */}
        <div className="grid gap-6 md:grid-cols-4">
          <StatCard
            title="Revenue This Month"
            value={`Ksh ${(stats?.totalRevenueThisMonth ?? 0).toLocaleString()}`}
            icon={<Banknote className="h-6 w-6" />}
          />
          <StatCard
            title="Overdue"
            value={`Ksh ${(stats?.overdueAmount ?? 0).toLocaleString()}`}
            icon={<AlertCircle className="h-6 w-6" />}
            className={stats && stats.totalOverdue > 0 ? 'border-red-200' : ''}
          />
          <StatCard
            title="Pending"
            value={`Ksh ${(stats?.pendingAmount ?? 0).toLocaleString()}`}
            icon={<TrendingUp className="h-6 w-6" />}
          />
          <StatCard
            title="Collection Rate"
            value={`${stats?.collectionRate ?? 0}%`}
            icon={<CheckCircle className="h-6 w-6" />}
            trend={
              stats
                ? {
                    value: `${stats.totalPaid} paid of ${stats.totalPaid + stats.totalOverdue + stats.totalPending}`,
                    isPositive: stats.collectionRate >= 80,
                  }
                : undefined
            }
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1">
            <Input
              placeholder="Search by tenant, property, or unit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'paid', label: 'Paid' },
              { value: 'pending', label: 'Pending' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'partial', label: 'Partial' },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>

        {/* Payments Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : payments.length > 0 ? (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Property / Unit</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Paid Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.tenant_name}</TableCell>
                    <TableCell>
                      {payment.property_name}
                      {payment.unit_number ? ` — Unit ${payment.unit_number}` : ''}
                    </TableCell>
                    <TableCell>
                      Ksh {payment.amount.toLocaleString()}
                      {payment.status === 'partial' && Number(payment.amount_paid ?? 0) > 0 && (
                        <span className="block text-xs text-amber-700">
                          Ksh {Number(payment.amount_paid).toLocaleString()} received
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(payment.due_date).toLocaleDateString('en-KE', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      {payment.paid_date
                        ? new Date(payment.paid_date).toLocaleDateString('en-KE', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {payment.payment_method
                        ? methodLabels[payment.payment_method] ?? payment.payment_method
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[payment.status]} className="capitalize">
                        {payment.status}
                      </Badge>
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      {confirmDeleteId === payment.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 whitespace-nowrap">Delete?</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            isLoading={isDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white border-0"
                            onClick={() => handleDelete(payment.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          {payment.status !== 'paid' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRecordingPayment(payment)}
                            >
                              Record
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingPayment(payment)}
                            title="Edit payment"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeleteId(payment.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            title="Delete payment"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <EmptyState
            icon={<Banknote className="h-10 w-10" />}
            title="No payments found"
            description={
              searchQuery || statusFilter
                ? 'No payments match the current filters.'
                : 'Payments are generated automatically when you assign a tenant to a unit. You can also add them manually.'
            }
            action={
              !searchQuery && !statusFilter
                ? { label: 'Add Payment', onClick: () => setIsAddOpen(true) }
                : undefined
            }
          />
        )}
      </div>

      {/* Add Payment Modal */}
      <AddPaymentForm
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        leases={activeLeases}
        onSuccess={fetchPayments}
      />

      {/* Edit Payment Modal */}
      {editingPayment && (
        <EditPaymentForm
          isOpen={!!editingPayment}
          onClose={() => setEditingPayment(null)}
          payment={editingPayment}
          onSuccess={() => {
            fetchPayments();
            setEditingPayment(null);
          }}
        />
      )}

      {/* Record Payment Modal */}
      {recordingPayment && (
        <RecordPaymentForm
          isOpen={!!recordingPayment}
          onClose={() => setRecordingPayment(null)}
          paymentId={recordingPayment.id}
          defaultAmount={recordingPayment.amount}
          tenantName={recordingPayment.tenant_name}
          dueDate={recordingPayment.due_date}
          onSuccess={fetchPayments}
        />
      )}
    </DashboardLayout>
  );
}
