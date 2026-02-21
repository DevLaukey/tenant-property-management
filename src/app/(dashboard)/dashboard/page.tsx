'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Banknote, FileText, Users, AlertCircle, Clock } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getDashboardData, DashboardData } from '@/lib/actions/dashboard';

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getDashboardData().then((result) => {
      if (result.data) setData(result.data);
      setIsLoading(false);
    });
  }, []);

  const stats = data?.stats;
  const recentPayments = data?.recentPayments ?? [];
  const expiringLeases = data?.expiringLeases ?? [];
  const unpaidPayments = data?.unpaidPayments ?? [];

  const overdueCount = unpaidPayments.filter((p) => p.status === 'overdue').length;
  const pendingCount = unpaidPayments.filter((p) => p.status === 'pending').length;
  const totalUnpaidAmount = unpaidPayments.reduce((s, p) => s + p.amount, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's what's happening.</p>
        </div>

        {/* Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </>
          ) : (
            <>
              <StatCard
                title="Total Properties"
                value={stats?.totalProperties ?? 0}
                icon={<Building2 className="h-6 w-6" />}
              />
              <StatCard
                title="Active Leases"
                value={stats?.activeLeases ?? 0}
                icon={<FileText className="h-6 w-6" />}
                trend={
                  expiringLeases.length > 0
                    ? { value: `${expiringLeases.length} expiring soon`, isPositive: false }
                    : undefined
                }
              />
              <StatCard
                title="Total Tenants"
                value={stats?.totalTenants ?? 0}
                icon={<Users className="h-6 w-6" />}
              />
              <StatCard
                title="Revenue This Month"
                value={`Ksh ${(stats?.monthlyRevenue ?? 0).toLocaleString()}`}
                icon={<Banknote className="h-6 w-6" />}
              />
            </>
          )}
        </div>

        {/* Outstanding Payments — full-width table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>Outstanding Payments</CardTitle>
              {!isLoading && unpaidPayments.length > 0 && (
                <p className="text-sm text-gray-500 mt-0.5">
                  {overdueCount > 0 && (
                    <span className="text-red-600 font-medium">{overdueCount} overdue</span>
                  )}
                  {overdueCount > 0 && pendingCount > 0 && <span className="mx-1">·</span>}
                  {pendingCount > 0 && (
                    <span className="text-gray-600">{pendingCount} upcoming</span>
                  )}
                  <span className="mx-1">·</span>
                  <span className="font-medium">Ksh {totalUnpaidAmount.toLocaleString()} total</span>
                </p>
              )}
            </div>
            {!isLoading && (
              <Button variant="outline" size="sm" onClick={() => router.push('/payments')}>
                View All
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : unpaidPayments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Property / Unit</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unpaidPayments.map((payment) => {
                    const isOverdue = payment.status === 'overdue';
                    return (
                      <TableRow
                        key={payment.id}
                        className={isOverdue ? 'bg-red-50 hover:bg-red-50' : ''}
                      >
                        <TableCell className="font-medium">{payment.tenant_name}</TableCell>
                        <TableCell className="text-gray-600">
                          {payment.property_name}
                          {payment.unit_number ? ` — Unit ${payment.unit_number}` : ''}
                        </TableCell>
                        <TableCell className={isOverdue ? 'font-semibold text-red-700' : 'font-medium'}>
                          Ksh {payment.amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {new Date(payment.due_date).toLocaleDateString('en-KE', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isOverdue ? 'danger' : 'default'} className="capitalize">
                            {payment.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-3">
                  <Banknote className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-sm font-medium text-gray-900">All payments are up to date</p>
                <p className="text-xs text-gray-500 mt-1">No outstanding or overdue payments.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Payments */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : recentPayments.length > 0 ? (
                <div className="space-y-1">
                  {recentPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between py-3 border-b last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600 shrink-0">
                          <Banknote className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{payment.tenant_name}</p>
                          <p className="text-xs text-gray-500">
                            {payment.property_name}
                            {payment.unit_number ? ` — Unit ${payment.unit_number}` : ''}
                            {' · '}
                            {new Date(payment.paid_date).toLocaleDateString('en-KE', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                      <span className="font-semibold text-green-600 shrink-0">
                        Ksh {payment.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 py-6 text-center">No payments recorded yet.</p>
              )}

              {!isLoading && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-4"
                  onClick={() => router.push('/payments')}
                >
                  View All Payments
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Expiring Leases */}
          <Card>
            <CardHeader>
              <CardTitle>Leases Expiring Soon</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : expiringLeases.length > 0 ? (
                <div className="space-y-3">
                  {expiringLeases.map((lease) => (
                    <div
                      key={lease.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{lease.tenant_name}</p>
                        <p className="text-sm text-gray-600">
                          {lease.property_name}
                          {lease.unit_number ? ` — Unit ${lease.unit_number}` : ''}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Ends{' '}
                          {new Date(lease.end_date).toLocaleDateString('en-KE', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <Badge variant={lease.days_left <= 14 ? 'danger' : 'warning'}>
                        <Clock className="h-3 w-3 mr-1" />
                        {lease.days_left}d left
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 py-6 text-center">
                  No leases expiring in the next 60 days.
                </p>
              )}

              {!isLoading && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-4"
                  onClick={() => router.push('/leases')}
                >
                  View All Leases
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
