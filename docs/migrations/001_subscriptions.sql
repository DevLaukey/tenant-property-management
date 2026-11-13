-- =====================================================
-- MIGRATION 001: SUBSCRIPTIONS & BILLING
-- =====================================================
-- Run in the Supabase SQL editor after docs/database-schema.sql.
-- Safe to re-run (idempotent).
--
-- Model: owners and property managers hold a subscription. Tenants do not.
-- Every new owner/manager gets a 14-day trial automatically. Payments are
-- prepaid per billing period (M-Pesa STK Push or Paystack card); each
-- successful payment extends current_period_end. All writes to these
-- tables happen server-side with the service role key.
-- =====================================================

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE billing_cycle AS ENUM ('monthly', 'annual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE billing_provider AS ENUM ('mpesa', 'paystack');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE billing_transaction_status AS ENUM ('pending', 'success', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------
-- Profiles: onboarding flag
-- -----------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- -----------------------------------------------------
-- Subscriptions (one per account)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL DEFAULT 'growth',          -- see src/lib/billing/plans.ts
    billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
    status subscription_status NOT NULL DEFAULT 'trialing',
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------
-- Billing transactions (M-Pesa STK / Paystack attempts)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS billing_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    plan_id TEXT NOT NULL,
    billing_cycle billing_cycle NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KES',
    provider billing_provider NOT NULL,
    status billing_transaction_status NOT NULL DEFAULT 'pending',
    phone TEXT,                                      -- 2547XXXXXXXX for M-Pesa
    provider_reference TEXT UNIQUE,                  -- M-Pesa CheckoutRequestID / Paystack reference
    merchant_request_id TEXT,                        -- M-Pesa MerchantRequestID
    receipt_number TEXT,                             -- M-Pesa receipt / Paystack transaction id
    result_code TEXT,
    result_desc TEXT,
    raw_callback JSONB,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_transactions_user ON billing_transactions(user_id, created_at DESC);

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_billing_transactions_updated_at ON billing_transactions;
CREATE TRIGGER update_billing_transactions_updated_at BEFORE UPDATE ON billing_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Auto-create profile on signup (from auth metadata)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role, organization_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'owner'),
    NEW.raw_user_meta_data->>'organization_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- -----------------------------------------------------
-- Auto-start a 14-day trial for owners / managers
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION start_trial_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.role IN ('owner', 'property_manager') THEN
    INSERT INTO public.subscriptions (user_id, plan_id, status, trial_ends_at)
    VALUES (NEW.id, 'growth', 'trialing', NOW() + INTERVAL '14 days')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_start_trial ON profiles;
CREATE TRIGGER on_profile_created_start_trial
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION start_trial_subscription();

-- Backfill: existing owners/managers get a fresh trial and skip onboarding
INSERT INTO subscriptions (user_id, plan_id, status, trial_ends_at)
SELECT id, 'growth', 'trialing', NOW() + INTERVAL '14 days'
FROM profiles
WHERE role IN ('owner', 'property_manager')
ON CONFLICT (user_id) DO NOTHING;

UPDATE profiles SET onboarding_completed = TRUE
WHERE onboarding_completed = FALSE AND created_at < NOW() - INTERVAL '1 minute';

-- -----------------------------------------------------
-- RLS: users read their own billing data; writes are service-role only
-- -----------------------------------------------------
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
CREATE POLICY "Users can view own subscription"
    ON subscriptions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own billing transactions" ON billing_transactions;
CREATE POLICY "Users can view own billing transactions"
    ON billing_transactions FOR SELECT
    USING (auth.uid() = user_id);
