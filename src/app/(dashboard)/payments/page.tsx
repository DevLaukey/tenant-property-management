'use client';

import { useState } from 'react';
import { Banknote, Download, TrendingUp, AlertCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Mock data
const mockPayments = [
  {
    id: '1',
    tenant_name: 'John Smith',
    property_name: 'Sunset Apartments',
    unit_number: '101',
    amount: 1500,
    due_date: '2024-01-01',
    paid_date: '2024-01-02',
    status: 'paid' as const,
  },
  {
    id: '2',
    tenant_name: 'Sarah Johnson',
    property_name: 'Downtown Plaza',
    unit_number: '205',
    amount: 2200,
    due_date: '2024-01-01',
    paid_date: null,
    status: 'overdue' as const,
  },
  {
    id: '3',
    tenant_name: 'Mike Davis',
    property_name: 'Sunset Apartments',
    unit_number: '102',
    amount: 1200,
    due_date: '2024-02-01',
    paid_date: null,
    status: 'pending' as const,
  },
];

export default function PaymentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const payments = mockPayments;

  const totalRevenue = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const overdueAmount = payments
    .filter((p) => p.status === 'overdue')
    .reduce((sum, p) => sum + p.amount, 0);

  const statusColors = {
    paid: 'success' as const,
    partial: 'warning' as const,
    overdue: 'danger' as const,
    pending: 'default' as const,
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
          <Button variant="outline">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-6 md:grid-cols-3">
          <StatCard
            title="Total Revenue (This Month)"
            value={`Ksh. ${totalRevenue.toLocaleString()}`}
            icon={<Banknote className="h-6 w-6" />}
            trend={{ value: '12% from last month', isPositive: true }}
          />
          <StatCard
            title="Overdue Payments"
            value={`Ksh. ${overdueAmount.toLocaleString()}`}
            icon={<AlertCircle className="h-6 w-6" />}
            className="border-red-200"
          />
          <StatCard
            title="Collection Rate"
            value="95%"
            icon={<TrendingUp className="h-6 w-6" />}
            trend={{ value: '2% from last month', isPositive: true }}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1">
            <Input
              placeholder="Search by tenant or property..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select
            options={[
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
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Property/Unit</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Paid Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">{payment.tenant_name}</TableCell>
                  <TableCell>
                    {payment.property_name} - Unit {payment.unit_number}
                  </TableCell>
                  <TableCell>Ksh. {payment.amount.toLocaleString()}</TableCell>
                  <TableCell>{new Date(payment.due_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {payment.paid_date
                      ? new Date(payment.paid_date).toLocaleDateString()
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColors[payment.status]} className="capitalize">
                      {payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {payment.status !== 'paid' && (
                      <Button variant="ghost" size="sm">
                        Record Payment
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </DashboardLayout>
  );
}
