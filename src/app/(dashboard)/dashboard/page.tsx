'use client';

import { Building2, Banknote, FileText, Users, AlertCircle, Wrench } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

// Mock data
const recentActivities = [
  {
    id: '1',
    type: 'payment',
    description: 'Payment received from John Smith',
    amount: 'Ksh. 1,500',
    time: '2 hours ago',
  },
  {
    id: '2',
    type: 'lease',
    description: 'New lease signed - Unit 205',
    amount: null,
    time: '5 hours ago',
  },
  {
    id: '3',
    type: 'maintenance',
    description: 'Maintenance request submitted - Unit 101',
    amount: null,
    time: '1 day ago',
  },
];

const upcomingLeases = [
  {
    id: '1',
    tenant_name: 'Emily Brown',
    unit: 'Unit 305',
    end_date: '2024-02-28',
    days_left: 15,
  },
  {
    id: '2',
    tenant_name: 'Tom Wilson',
    unit: 'Unit 102',
    end_date: '2024-03-15',
    days_left: 30,
  },
];

export default function DashboardPage() {
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
          <StatCard
            title="Total Properties"
            value="12"
            icon={<Building2 className="h-6 w-6" />}
            trend={{ value: '2 added this month', isPositive: true }}
          />
          <StatCard
            title="Active Leases"
            value="45"
            icon={<FileText className="h-6 w-6" />}
            trend={{ value: '3 expiring soon', isPositive: false }}
          />
          <StatCard
            title="Total Tenants"
            value="48"
            icon={<Users className="h-6 w-6" />}
          />
          <StatCard
            title="Monthly Revenue"
            value="Ksh. 68,500"
            icon={<Banknote className="h-6 w-6" />}
            trend={{ value: '12% from last month', isPositive: true }}
          />
        </div>

        {/* Alerts */}
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900">Attention Required</h3>
                <p className="text-sm text-orange-800 mt-1">
                  You have 3 overdue payments totaling Ksh. 5,200 and 2 urgent maintenance requests.
                </p>
                <div className="flex gap-3 mt-3">
                  <Button variant="outline" size="sm">
                    View Overdue Payments
                  </Button>
                  <Button variant="outline" size="sm">
                    View Maintenance
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          activity.type === 'payment'
                            ? 'bg-green-100 text-green-600'
                            : activity.type === 'lease'
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-orange-100 text-orange-600'
                        }`}
                      >
                        {activity.type === 'payment' && <Banknote className="h-5 w-5" />}
                        {activity.type === 'lease' && <FileText className="h-5 w-5" />}
                        {activity.type === 'maintenance' && <Wrench className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {activity.description}
                        </p>
                        <p className="text-xs text-gray-500">{activity.time}</p>
                      </div>
                    </div>
                    {activity.amount && (
                      <span className="font-semibold text-green-600">{activity.amount}</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Expiring Leases */}
          <Card>
            <CardHeader>
              <CardTitle>Expiring Leases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingLeases.map((lease) => (
                  <div
                    key={lease.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{lease.tenant_name}</p>
                      <p className="text-sm text-gray-600">{lease.unit}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Ends {new Date(lease.end_date).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={lease.days_left <= 15 ? 'danger' : 'warning'}>
                      {lease.days_left} days
                    </Badge>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full mt-4">
                View All Leases
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
