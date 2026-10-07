import { BillingCycle } from '@/types';

export type PlanId = 'starter' | 'growth' | 'pro';

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  /** Prices in KES */
  priceMonthly: number;
  priceAnnual: number;
  /** null = unlimited */
  maxProperties: number | null;
  maxUnits: number | null;
  features: string[];
  highlighted?: boolean;
}

export const TRIAL_DAYS = 14;
/** Days after current_period_end during which access continues (status past_due) */
export const GRACE_PERIOD_DAYS = 3;
/** Plan whose limits apply during the free trial */
export const TRIAL_PLAN_ID: PlanId = 'growth';

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'For individual landlords getting organised',
    priceMonthly: 1500,
    priceAnnual: 15000,
    maxProperties: 2,
    maxUnits: 20,
    features: [
      'Up to 2 properties',
      'Up to 20 units',
      'Tenant & lease management',
      'Rent payment tracking',
      'Maintenance requests',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    description: 'For growing portfolios and small agencies',
    priceMonthly: 4500,
    priceAnnual: 45000,
    maxProperties: 10,
    maxUnits: 100,
    highlighted: true,
    features: [
      'Up to 10 properties',
      'Up to 100 units',
      'Everything in Starter',
      'M-Pesa paybill rent instructions',
      'Document storage',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For property management companies',
    priceMonthly: 12000,
    priceAnnual: 120000,
    maxProperties: null,
    maxUnits: null,
    features: [
      'Unlimited properties',
      'Unlimited units',
      'Everything in Growth',
      'Priority support',
    ],
  },
];

export function getPlan(id: string | null | undefined): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function isPlanId(id: unknown): id is PlanId {
  return typeof id === 'string' && PLANS.some((p) => p.id === id);
}

export function getPlanPrice(plan: Plan, cycle: BillingCycle): number {
  return cycle === 'annual' ? plan.priceAnnual : plan.priceMonthly;
}
