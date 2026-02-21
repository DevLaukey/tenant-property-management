'use server';

import { createClient, getUser } from '@/lib/supabase/server';

export type DashboardStats = {
  totalProperties: number;
  activeLeases: number;
  totalTenants: number;
  monthlyRevenue: number;
  overdueCount: number;
  overdueAmount: number;
};

export type RecentPayment = {
  id: string;
  tenant_name: string;
  amount: number;
  paid_date: string;
  property_name: string;
  unit_number: string;
};

export type ExpiringLease = {
  id: string;
  tenant_name: string;
  unit_number: string;
  property_name: string;
  end_date: string;
  days_left: number;
};

export type UnpaidPayment = {
  id: string;
  tenant_name: string;
  amount: number;
  due_date: string;
  status: 'overdue' | 'pending';
  property_name: string;
  unit_number: string;
};

export type DashboardData = {
  stats: DashboardStats;
  recentPayments: RecentPayment[];
  expiringLeases: ExpiringLease[];
  unpaidPayments: UnpaidPayment[];
};

export async function getDashboardData(): Promise<{ error?: string; data?: DashboardData }> {
  const supabase = await createClient();
  const { user } = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  const in60Days = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Run properties count and leases fetch in parallel
  const [propertiesRes, leasesRes] = await Promise.all([
    supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .eq('is_archived', false),
    supabase
      .from('leases')
      .select(`
        id, status, end_date,
        unit:units!inner(
          id,
          unit_number,
          property:properties!inner(id, name, owner_id)
        ),
        lease_tenants(
          tenant:tenants(id, first_name, last_name)
        )
      `)
      .eq('unit.property.owner_id', user.id),
  ]);

  const totalProperties = propertiesRes.count ?? 0;
  const allLeases = (leasesRes.data as any[]) ?? [];

  const activeLeases = allLeases.filter((l) => l.status === 'active');
  const leaseIds = allLeases.map((l) => l.id);

  // Count unique tenants across all leases for this landlord
  const tenantIds = new Set<string>();
  allLeases.forEach((l) => {
    l.lease_tenants?.forEach((lt: any) => {
      if (lt.tenant?.id) tenantIds.add(lt.tenant.id);
    });
  });
  const totalTenants = tenantIds.size;

  // Leases expiring within 60 days
  const expiringLeases: ExpiringLease[] = activeLeases
    .filter((l) => l.end_date >= todayStr && l.end_date <= in60Days)
    .map((l) => {
      const tenant = l.lease_tenants?.[0]?.tenant;
      const msLeft = new Date(l.end_date).getTime() - today.getTime();
      const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
      return {
        id: l.id,
        tenant_name: tenant ? `${tenant.first_name} ${tenant.last_name}` : 'Unknown',
        unit_number: l.unit?.unit_number ?? '',
        property_name: l.unit?.property?.name ?? '',
        end_date: l.end_date,
        days_left: daysLeft,
      };
    })
    .sort((a, b) => a.days_left - b.days_left);

  // No leases → return early with zeros
  if (leaseIds.length === 0) {
    return {
      data: {
        stats: {
          totalProperties,
          activeLeases: activeLeases.length,
          totalTenants,
          monthlyRevenue: 0,
          overdueCount: 0,
          overdueAmount: 0,
        },
        recentPayments: [],
        expiringLeases,
        unpaidPayments: [],
      },
    };
  }

  // Auto-mark overdue: pending payments past due date
  await supabase
    .from('payments')
    .update({ status: 'overdue' })
    .eq('status', 'pending')
    .lt('due_date', todayStr)
    .in('lease_id', leaseIds);

  // Fetch all payments for the user's leases
  const { data: payments } = await supabase
    .from('payments')
    .select('id, amount, status, paid_date, due_date, lease_id')
    .in('lease_id', leaseIds);

  const allPayments = (payments as any[]) ?? [];
  const leaseMap = Object.fromEntries(allLeases.map((l) => [l.id, l]));

  // Monthly revenue: payments paid this calendar month
  const monthlyRevenue = allPayments
    .filter(
      (p) =>
        p.status === 'paid' &&
        p.paid_date &&
        p.paid_date >= startOfMonth &&
        p.paid_date <= endOfMonth
    )
    .reduce((s: number, p: any) => s + p.amount, 0);

  // Overdue summary
  const overduePayments = allPayments.filter((p) => p.status === 'overdue');
  const overdueAmount = overduePayments.reduce((s: number, p: any) => s + p.amount, 0);

  // Unpaid payments: overdue + pending, overdue first then by due_date ascending
  const unpaidPayments: UnpaidPayment[] = allPayments
    .filter((p) => p.status === 'overdue' || p.status === 'pending')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'overdue' ? -1 : 1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    })
    .map((p) => {
      const lease = leaseMap[p.lease_id];
      const tenant = lease?.lease_tenants?.[0]?.tenant;
      return {
        id: p.id,
        tenant_name: tenant ? `${tenant.first_name} ${tenant.last_name}` : 'Unknown',
        amount: p.amount,
        due_date: p.due_date,
        status: p.status as 'overdue' | 'pending',
        property_name: lease?.unit?.property?.name ?? '',
        unit_number: lease?.unit?.unit_number ?? '',
      };
    });

  // Recent payments: last 5 paid, most recent first
  const recentPayments: RecentPayment[] = allPayments
    .filter((p) => p.status === 'paid' && p.paid_date)
    .sort((a, b) => new Date(b.paid_date).getTime() - new Date(a.paid_date).getTime())
    .slice(0, 5)
    .map((p) => {
      const lease = leaseMap[p.lease_id];
      const tenant = lease?.lease_tenants?.[0]?.tenant;
      return {
        id: p.id,
        tenant_name: tenant ? `${tenant.first_name} ${tenant.last_name}` : 'Unknown',
        amount: p.amount,
        paid_date: p.paid_date,
        property_name: lease?.unit?.property?.name ?? '',
        unit_number: lease?.unit?.unit_number ?? '',
      };
    });

  return {
    data: {
      stats: {
        totalProperties,
        activeLeases: activeLeases.length,
        totalTenants,
        monthlyRevenue,
        overdueCount: overduePayments.length,
        overdueAmount,
      },
      recentPayments,
      expiringLeases,
      unpaidPayments,
    },
  };
}
