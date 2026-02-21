'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Mail,
  Phone,
  Home,
  Calendar,
  Banknote,
  AlertCircle,
  CheckCircle,
  Clock,
  Pencil,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RecordPaymentForm } from '@/components/payments/record-payment-form';
import { PaymentInstructions } from '@/components/payments/payment-instructions';
import { TenantForm } from '@/components/tenants/tenant-form';
import { getTenant, deleteTenant, TenantWithLease } from '@/lib/actions/tenants';
import { getPayments, PaymentWithDetails } from '@/lib/actions/payments';
import { PaymentStatus, Tenant } from '@/types';

const paymentStatusColors: Record<PaymentStatus, 'success' | 'warning' | 'danger' | 'default'> = {
  paid: 'success',
  partial: 'warning',
  overdue: 'danger',
  pending: 'default',
};

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [tenant, setTenant] = useState<TenantWithLease | null>(null);
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recordingPayment, setRecordingPayment] = useState<PaymentWithDetails | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const tenantResult = await getTenant(id);

    if (tenantResult.data && !Array.isArray(tenantResult.data)) {
      const t = tenantResult.data as TenantWithLease;
      setTenant(t);

      if (t.current_lease_id) {
        const paymentsResult = await getPayments({ leaseId: t.current_lease_id });
        if (paymentsResult.data && Array.isArray(paymentsResult.data)) {
          // Sort: overdue first, then pending by due_date, then paid
          const sorted = [...paymentsResult.data].sort((a, b) => {
            const order = { overdue: 0, pending: 1, partial: 2, paid: 3 };
            if (a.status !== b.status) return order[a.status] - order[b.status];
            return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          });
          setPayments(sorted);
        }
      }
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    const result = await deleteTenant(id);
    if (result.error) {
      setDeleteError(result.error);
      setIsDeleting(false);
      setConfirmDelete(false);
    } else {
      router.push('/tenants');
    }
  };

  // Payment summary stats
  const totalPaid = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const totalOverdue = payments.filter((p) => p.status === 'overdue').reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  const paidCount = payments.filter((p) => p.status === 'paid').length;
  const overdueCount = payments.filter((p) => p.status === 'overdue').length;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-pulse">
          <div className="h-10 w-64 bg-gray-200 rounded" />
          <div className="h-40 bg-gray-200 rounded-xl" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (!tenant) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-gray-500">Tenant not found.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back */}
        <Button variant="ghost" onClick={() => router.push('/tenants')} className="-ml-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Tenants
        </Button>

        {/* Tenant header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-2xl shrink-0">
              {tenant.first_name[0]}
              {tenant.last_name[0]}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {tenant.first_name} {tenant.last_name}
              </h1>
              <Badge
                variant={tenant.lease_status === 'active' ? 'success' : 'default'}
                className="mt-1"
              >
                {tenant.lease_status === 'active' ? 'Active Lease' : 'No Active Lease'}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" onClick={() => setIsEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            {!confirmDelete ? (
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(true)}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-200">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                <span className="text-sm text-red-700">Delete tenant?</span>
                <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleDelete}
                  isLoading={isDeleting}
                  className="bg-red-600 hover:bg-red-700 text-white border-0"
                >
                  Delete
                </Button>
              </div>
            )}
          </div>
        </div>

        {deleteError && (
          <div className="p-3 rounded-md bg-red-50 text-red-600 text-sm">{deleteError}</div>
        )}

        {/* Info + Lease cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Contact */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                <span>{tenant.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                <span>{tenant.phone}</span>
              </div>
              {tenant.notes && (
                <p className="mt-3 pt-3 border-t text-gray-500 italic">{tenant.notes}</p>
              )}
            </div>
          </Card>

          {/* Current Lease */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Lease</h2>
            {tenant.current_lease_id ? (
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center gap-3">
                  <Home className="h-4 w-4 text-gray-400 shrink-0" />
                  <span>
                    <span className="font-medium text-gray-800">{tenant.current_property}</span>
                    {' — '}Unit {tenant.current_unit}
                  </span>
                </div>
                {(tenant as any).lease_tenants?.[0]?.lease && (
                  <>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                      <span>
                        {new Date((tenant as any).lease_tenants[0].lease.start_date).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                        {' → '}
                        {new Date((tenant as any).lease_tenants[0].lease.end_date).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Banknote className="h-4 w-4 text-gray-400 shrink-0" />
                      <span>
                        Ksh {(tenant as any).lease_tenants[0].lease.monthly_rent.toLocaleString()}/mo
                        {' · '}due on the {(tenant as any).lease_tenants[0].lease.due_day}
                        {[1, 21].includes((tenant as any).lease_tenants[0].lease.due_day) ? 'st' :
                          [2, 22].includes((tenant as any).lease_tenants[0].lease.due_day) ? 'nd' :
                          [3, 23].includes((tenant as any).lease_tenants[0].lease.due_day) ? 'rd' : 'th'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No active lease. Assign a unit from the Tenants page.</p>
            )}
          </Card>
        </div>

        {/* Payment summary stats */}
        {payments.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-100">
              <CheckCircle className="h-8 w-8 text-green-500 shrink-0" />
              <div>
                <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Total Paid</p>
                <p className="text-xl font-bold text-green-900">Ksh {totalPaid.toLocaleString()}</p>
                <p className="text-xs text-green-600">{paidCount} payment{paidCount !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
              <AlertCircle className="h-8 w-8 text-red-400 shrink-0" />
              <div>
                <p className="text-xs font-medium text-red-700 uppercase tracking-wide">Overdue</p>
                <p className="text-xl font-bold text-red-900">Ksh {totalOverdue.toLocaleString()}</p>
                <p className="text-xs text-red-600">{overdueCount} payment{overdueCount !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200">
              <Clock className="h-8 w-8 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Upcoming</p>
                <p className="text-xl font-bold text-gray-900">Ksh {totalPending.toLocaleString()}</p>
                <p className="text-xs text-gray-500">
                  {payments.filter((p) => p.status === 'pending').length} payment
                  {payments.filter((p) => p.status === 'pending').length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Payment instructions — shown when tenant has an active lease */}
        {tenant.current_lease_id && tenant.current_unit && (
          <PaymentInstructions
            unitNumber={tenant.current_unit}
            monthlyRent={
              (tenant as any).lease_tenants?.find((lt: any) => lt.lease?.status === 'active')
                ?.lease?.monthly_rent ?? 0
            }
            tenantName={`${tenant.first_name} ${tenant.last_name}`}
          />
        )}

        {/* Payment history */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment History</h2>
          {payments.length > 0 ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Paid Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {new Date(payment.due_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="font-medium">
                        Ksh {payment.amount.toLocaleString()}
                        {payment.late_fee > 0 && (
                          <span className="ml-1 text-xs text-red-500">
                            +{payment.late_fee.toLocaleString()} late fee
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {payment.paid_date
                          ? new Date(payment.paid_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—'}
                      </TableCell>
                      <TableCell className="capitalize text-gray-500">
                        {payment.payment_method?.replace('_', ' ') ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={paymentStatusColors[payment.status]}
                          className="capitalize"
                        >
                          {payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {payment.status !== 'paid' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRecordingPayment(payment)}
                          >
                            Record
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <Card className="p-10 text-center text-gray-400">
              {tenant.current_lease_id
                ? 'No payment records yet.'
                : 'Assign this tenant to a unit to start tracking payments.'}
            </Card>
          )}
        </div>
      </div>

      {/* Edit Tenant Modal */}
      {tenant && (
        <TenantForm
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          tenant={tenant as unknown as Tenant}
          onSuccess={fetchData}
        />
      )}

      {/* Record Payment Modal */}
      {recordingPayment && (
        <RecordPaymentForm
          isOpen={!!recordingPayment}
          onClose={() => setRecordingPayment(null)}
          paymentId={recordingPayment.id}
          defaultAmount={recordingPayment.amount}
          tenantName={`${tenant.first_name} ${tenant.last_name}`}
          dueDate={recordingPayment.due_date}
          onSuccess={fetchData}
        />
      )}
    </DashboardLayout>
  );
}
