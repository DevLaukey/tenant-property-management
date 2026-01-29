'use client';

import { useState } from 'react';
import { Plus, Search, FileText } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';

// Mock data
const mockLeases = [
  {
    id: '1',
    unit_number: '101',
    property_name: 'Sunset Apartments',
    tenant_name: 'John Smith',
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    monthly_rent: 1500,
    status: 'active' as const,
  },
  {
    id: '2',
    unit_number: '205',
    property_name: 'Downtown Plaza',
    tenant_name: 'Sarah Johnson',
    start_date: '2024-03-01',
    end_date: '2025-02-28',
    monthly_rent: 2200,
    status: 'active' as const,
  },
  {
    id: '3',
    unit_number: '102',
    property_name: 'Sunset Apartments',
    tenant_name: 'Mike Davis',
    start_date: '2023-06-01',
    end_date: '2024-05-31',
    monthly_rent: 1200,
    status: 'expired' as const,
  },
];

export default function LeasesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const leases = mockLeases;

  const statusColors = {
    active: 'success' as const,
    pending: 'warning' as const,
    expired: 'danger' as const,
    terminated: 'default' as const,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Leases</h1>
            <p className="text-gray-600 mt-1">Manage all lease agreements</p>
          </div>
          <Button>
            <Plus className="h-4 w-4" />
            Create Lease
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1">
            <Input
              placeholder="Search by tenant or unit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select
            options={[
              { value: 'active', label: 'Active' },
              { value: 'pending', label: 'Pending' },
              { value: 'expired', label: 'Expired' },
              { value: 'terminated', label: 'Terminated' },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>

        {/* Leases Table */}
        {leases.length > 0 ? (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Property/Unit</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Rent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leases.map((lease) => (
                  <TableRow key={lease.id}>
                    <TableCell className="font-medium">{lease.tenant_name}</TableCell>
                    <TableCell>
                      {lease.property_name} - Unit {lease.unit_number}
                    </TableCell>
                    <TableCell>{new Date(lease.start_date).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(lease.end_date).toLocaleDateString()}</TableCell>
                    <TableCell>Ksh. {lease.monthly_rent.toLocaleString()}/mo</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[lease.status]} className="capitalize">
                        {lease.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <EmptyState
            icon={<FileText className="h-10 w-10" />}
            title="No leases found"
            description="Get started by creating your first lease agreement."
            action={{
              label: 'Create Lease',
              onClick: () => console.log('Create lease'),
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
