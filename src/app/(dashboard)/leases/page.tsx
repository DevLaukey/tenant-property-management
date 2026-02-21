'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Pencil, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LeaseForm } from '@/components/leases/lease-form';
import { getLeases, deleteLease, LeaseWithDetails } from '@/lib/actions/leases';
import { getAllUnits, UnitWithProperty } from '@/lib/actions/units';
import { getTenants, TenantWithLease } from '@/lib/actions/tenants';
import { LeaseStatus } from '@/types';

const statusColors = {
  active: 'success' as const,
  pending: 'warning' as const,
  expired: 'danger' as const,
  terminated: 'default' as const,
};

export default function LeasesPage() {
  const [leases, setLeases] = useState<LeaseWithDetails[]>([]);
  const [availableUnits, setAvailableUnits] = useState<UnitWithProperty[]>([]);
  const [allTenants, setAllTenants] = useState<TenantWithLease[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingLease, setEditingLease] = useState<LeaseWithDetails | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchLeases = useCallback(async () => {
    setIsLoading(true);
    const result = await getLeases(
      statusFilter ? { status: statusFilter as LeaseStatus } : undefined
    );
    if (result.data && Array.isArray(result.data)) {
      let data = result.data as LeaseWithDetails[];
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        data = data.filter(
          (l) =>
            l.tenant_name?.toLowerCase().includes(q) ||
            l.property_name?.toLowerCase().includes(q) ||
            l.unit?.unit_number?.toLowerCase().includes(q)
        );
      }
      setLeases(data);
    }
    setIsLoading(false);
  }, [searchQuery, statusFilter]);

  const fetchFormData = useCallback(async () => {
    const [unitsResult, tenantsResult] = await Promise.all([
      getAllUnits({ status: 'available' }),
      getTenants(),
    ]);
    if (unitsResult.data && Array.isArray(unitsResult.data)) {
      setAvailableUnits(unitsResult.data as UnitWithProperty[]);
    }
    if (tenantsResult.data && Array.isArray(tenantsResult.data)) {
      setAllTenants(tenantsResult.data as TenantWithLease[]);
    }
  }, []);

  useEffect(() => {
    fetchLeases();
    fetchFormData();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchLeases(), 300);
    return () => clearTimeout(t);
  }, [searchQuery, statusFilter]);

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    await deleteLease(id);
    setIsDeleting(false);
    setConfirmDeleteId(null);
    fetchLeases();
    fetchFormData(); // refresh available units
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
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New Lease
          </Button>
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
              { value: 'active', label: 'Active' },
              { value: 'pending', label: 'Pending' },
              { value: 'expired', label: 'Expired' },
              { value: 'terminated', label: 'Terminated' },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : leases.length > 0 ? (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Property / Unit</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Monthly Rent</TableHead>
                  <TableHead>Due Day</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leases.map((lease) => (
                  <TableRow key={lease.id}>
                    <TableCell className="font-medium">{lease.tenant_name}</TableCell>
                    <TableCell>
                      {lease.property_name}
                      {lease.unit?.unit_number ? ` — Unit ${lease.unit.unit_number}` : ''}
                    </TableCell>
                    <TableCell>
                      {new Date(lease.start_date).toLocaleDateString('en-KE', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      {new Date(lease.end_date).toLocaleDateString('en-KE', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>Ksh {lease.monthly_rent.toLocaleString()}/mo</TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {lease.due_day}
                      {[1, 21].includes(lease.due_day) ? 'st' : [2, 22].includes(lease.due_day) ? 'nd' : [3, 23].includes(lease.due_day) ? 'rd' : 'th'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[lease.status]} className="capitalize">
                        {lease.status}
                      </Badge>
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      {confirmDeleteId === lease.id ? (
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
                            onClick={() => handleDelete(lease.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingLease(lease)}
                            title="Edit lease"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeleteId(lease.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            title="Delete lease"
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
            icon={<FileText className="h-10 w-10" />}
            title="No leases found"
            description={
              searchQuery || statusFilter
                ? 'No leases match the current filters.'
                : 'Create a lease to link a tenant to a unit and start tracking payments.'
            }
            action={
              !searchQuery && !statusFilter
                ? { label: 'New Lease', onClick: () => setIsCreateOpen(true) }
                : undefined
            }
          />
        )}
      </div>

      {/* Create Lease Modal */}
      <LeaseForm
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        availableUnits={availableUnits}
        tenants={allTenants}
        onSuccess={() => {
          fetchLeases();
          fetchFormData();
        }}
      />

      {/* Edit Lease Modal */}
      {editingLease && (
        <LeaseForm
          isOpen={!!editingLease}
          onClose={() => setEditingLease(null)}
          lease={editingLease}
          onSuccess={() => {
            fetchLeases();
            setEditingLease(null);
          }}
        />
      )}
    </DashboardLayout>
  );
}
