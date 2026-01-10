'use client';

import { useState } from 'react';
import { Plus, Search, Wrench } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';

// Mock data
const mockRequests = [
  {
    id: '1',
    title: 'Leaking faucet in kitchen',
    property_name: 'Sunset Apartments',
    unit_number: '101',
    tenant_name: 'John Smith',
    category: 'Plumbing',
    priority: 'medium' as const,
    status: 'submitted' as const,
    created_at: '2024-01-15',
  },
  {
    id: '2',
    title: 'Broken air conditioning unit',
    property_name: 'Downtown Plaza',
    unit_number: '205',
    tenant_name: 'Sarah Johnson',
    category: 'HVAC',
    priority: 'high' as const,
    status: 'in_progress' as const,
    created_at: '2024-01-14',
  },
  {
    id: '3',
    title: 'Replace bathroom light fixture',
    property_name: 'Sunset Apartments',
    unit_number: '102',
    tenant_name: 'Mike Davis',
    category: 'Electrical',
    priority: 'low' as const,
    status: 'completed' as const,
    created_at: '2024-01-10',
  },
];

export default function MaintenancePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const requests = mockRequests;

  const priorityColors = {
    low: 'default' as const,
    medium: 'warning' as const,
    high: 'danger' as const,
    urgent: 'danger' as const,
  };

  const statusColors = {
    submitted: 'default' as const,
    in_progress: 'primary' as const,
    completed: 'success' as const,
    cancelled: 'default' as const,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Maintenance Requests</h1>
            <p className="text-gray-600 mt-1">Track and manage maintenance requests</p>
          </div>
          <Button>
            <Plus className="h-4 w-4" />
            Create Request
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1">
            <Input
              placeholder="Search requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select
            options={[
              { value: 'submitted', label: 'Submitted' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
          <Select
            options={[
              { value: 'low', label: 'Low Priority' },
              { value: 'medium', label: 'Medium Priority' },
              { value: 'high', label: 'High Priority' },
              { value: 'urgent', label: 'Urgent' },
            ]}
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          />
        </div>

        {/* Requests Table */}
        {requests.length > 0 ? (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Property/Unit</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.title}</TableCell>
                    <TableCell>
                      {request.property_name} - Unit {request.unit_number}
                    </TableCell>
                    <TableCell>{request.tenant_name}</TableCell>
                    <TableCell>{request.category}</TableCell>
                    <TableCell>
                      <Badge variant={priorityColors[request.priority]} className="capitalize">
                        {request.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusColors[request.status]}
                        className="capitalize"
                      >
                        {request.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(request.created_at).toLocaleDateString()}
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
            icon={<Wrench className="h-10 w-10" />}
            title="No maintenance requests"
            description="There are no maintenance requests at this time."
            action={{
              label: 'Create Request',
              onClick: () => console.log('Create request'),
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
