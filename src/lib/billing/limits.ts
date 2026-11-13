import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSubscriptionAccess } from './access';

export interface Usage {
  properties: number;
  units: number;
}

export interface LimitCheck {
  allowed: boolean;
  error?: string;
}

export async function getUsage(userId: string): Promise<Usage> {
  const supabase = await createClient();

  const { count: properties } = await supabase
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .eq('is_archived', false);

  const { count: units } = await supabase
    .from('units')
    .select('id, properties!inner(owner_id)', { count: 'exact', head: true })
    .eq('properties.owner_id', userId)
    .eq('is_archived', false);

  return { properties: properties ?? 0, units: units ?? 0 };
}

async function getAccessForUser(userId: string) {
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status, plan_id, trial_ends_at, current_period_end')
    .eq('user_id', userId)
    .maybeSingle();
  return getSubscriptionAccess(sub);
}

export async function checkCanAddProperty(userId: string): Promise<LimitCheck> {
  const access = await getAccessForUser(userId);
  if (!access.hasAccess || !access.plan) {
    return { allowed: false, error: 'Your subscription is inactive. Renew it from the Billing page to continue.' };
  }
  if (access.plan.maxProperties === null) return { allowed: true };

  const usage = await getUsage(userId);
  if (usage.properties >= access.plan.maxProperties) {
    return {
      allowed: false,
      error: `Your ${access.plan.name} plan allows up to ${access.plan.maxProperties} properties. Upgrade your plan on the Billing page to add more.`,
    };
  }
  return { allowed: true };
}

export async function checkCanAddUnit(userId: string): Promise<LimitCheck> {
  const access = await getAccessForUser(userId);
  if (!access.hasAccess || !access.plan) {
    return { allowed: false, error: 'Your subscription is inactive. Renew it from the Billing page to continue.' };
  }
  if (access.plan.maxUnits === null) return { allowed: true };

  const usage = await getUsage(userId);
  if (usage.units >= access.plan.maxUnits) {
    return {
      allowed: false,
      error: `Your ${access.plan.name} plan allows up to ${access.plan.maxUnits} units. Upgrade your plan on the Billing page to add more.`,
    };
  }
  return { allowed: true };
}
