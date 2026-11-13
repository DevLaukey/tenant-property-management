-- =====================================================
-- MIGRATION 002: EQUITY BANK RENT COLLECTION
-- =====================================================
-- Run in the Supabase SQL editor after 001_subscriptions.sql.
-- Safe to re-run (idempotent).
--
-- Tenants pay into the Equity account with an account reference of the form
--   <PROPERTY CODE>#<UNIT>      e.g.  VIV#A1
-- The property code is set per property (properties.payment_code). Incoming
-- credits arrive from Equity (Jenga IPN webhook, or by reading the account
-- statement) and are applied to the oldest unpaid rent for that unit's
-- active lease by record_bank_payment(), which runs server-side with the
-- service role key only.
-- =====================================================

-- -----------------------------------------------------
-- Property payment code (the "VIV" in VIV#A1)
-- -----------------------------------------------------
ALTER TABLE properties ADD COLUMN IF NOT EXISTS payment_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_payment_code
    ON properties (UPPER(payment_code))
    WHERE payment_code IS NOT NULL;

-- -----------------------------------------------------
-- Payments: track how much of each rent row has been received,
-- so part-payments can be added up across several bank credits.
-- -----------------------------------------------------
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0;

UPDATE payments
   SET amount_paid = amount + COALESCE(late_fee, 0)
 WHERE status = 'paid' AND amount_paid = 0;

-- -----------------------------------------------------
-- Bank transactions (every credit seen from Equity)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS bank_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider TEXT NOT NULL DEFAULT 'equity',
    bank_reference TEXT NOT NULL,            -- Equity transaction reference
    alt_reference TEXT,                      -- second reference from the IPN, if any
    account_reference TEXT,                  -- raw reference the tenant typed, e.g. VIV#A1
    payment_code TEXT,                       -- parsed: VIV
    unit_code TEXT,                          -- parsed: A1
    amount DECIMAL(12,2) NOT NULL,
    paid_at TIMESTAMPTZ,
    payer_name TEXT,
    payer_phone TEXT,
    narration TEXT,
    source TEXT NOT NULL CHECK (source IN ('ipn', 'statement')),
    status TEXT NOT NULL DEFAULT 'unmatched' CHECK (status IN ('matched', 'unmatched', 'duplicate')),
    match_error TEXT,
    -- set when the same credit was later seen from the other source
    twin_reference TEXT,
    owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
    raw JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (provider, bank_reference)
);

CREATE INDEX IF NOT EXISTS idx_bank_tx_owner ON bank_transactions(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_bank_tx_alt_ref ON bank_transactions(provider, alt_reference);
CREATE INDEX IF NOT EXISTS idx_bank_tx_codes ON bank_transactions(UPPER(payment_code), UPPER(unit_code), amount);

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view their bank transactions" ON bank_transactions;
CREATE POLICY "Owners can view their bank transactions"
    ON bank_transactions FOR SELECT
    USING (owner_id = auth.uid());
-- No insert/update/delete policies: writes go through record_bank_payment()
-- with the service role key.

-- -----------------------------------------------------
-- record_bank_payment: store one credit and apply it to rent
-- Returns outcome: 'matched' | 'unmatched' | 'duplicate'
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION record_bank_payment(
    p_provider TEXT,
    p_bank_reference TEXT,
    p_alt_reference TEXT,
    p_account_reference TEXT,
    p_payment_code TEXT,
    p_unit_code TEXT,
    p_amount NUMERIC,
    p_paid_at TIMESTAMPTZ,
    p_payer_name TEXT,
    p_payer_phone TEXT,
    p_narration TEXT,
    p_source TEXT,
    p_raw JSONB
)
RETURNS TABLE (outcome TEXT, transaction_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tx_id UUID;
    v_twin_id UUID;
    v_property RECORD;
    v_unit_id UUID;
    v_lease_id UUID;
    v_paid_date DATE;
    v_remaining NUMERIC;
    v_pay RECORD;
    v_due NUMERIC;
    v_apply NUMERIC;
BEGIN
    IF p_bank_reference IS NULL OR p_bank_reference = '' OR p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'record_bank_payment: bank reference and a positive amount are required';
    END IF;

    -- Already seen under either of its references?
    IF EXISTS (
        SELECT 1 FROM bank_transactions
         WHERE provider = p_provider
           AND (bank_reference IN (p_bank_reference, COALESCE(p_alt_reference, ''))
                OR alt_reference = p_bank_reference
                OR twin_reference = p_bank_reference)
    ) THEN
        RETURN QUERY SELECT 'duplicate'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    -- The same credit seen from the other source (IPN vs statement) may carry a
    -- different reference. Treat it as the same payment when code, unit and
    -- amount agree within 2 days, and the earlier row has not already been
    -- paired with another credit.
    IF p_payment_code IS NOT NULL AND p_unit_code IS NOT NULL THEN
        SELECT id INTO v_twin_id
          FROM bank_transactions
         WHERE provider = p_provider
           AND source <> p_source
           AND status <> 'duplicate'
           AND twin_reference IS NULL
           AND UPPER(payment_code) = UPPER(p_payment_code)
           AND UPPER(unit_code) = UPPER(p_unit_code)
           AND amount = p_amount
           AND ABS(EXTRACT(EPOCH FROM (COALESCE(paid_at, created_at) - COALESCE(p_paid_at, NOW())))) <= 2 * 86400
         ORDER BY created_at
         LIMIT 1
         FOR UPDATE;

        IF v_twin_id IS NOT NULL THEN
            UPDATE bank_transactions
               SET twin_reference = p_bank_reference, updated_at = NOW()
             WHERE id = v_twin_id;

            INSERT INTO bank_transactions (
                provider, bank_reference, alt_reference, account_reference, payment_code, unit_code,
                amount, paid_at, payer_name, payer_phone, narration, source, status, match_error, raw
            ) VALUES (
                p_provider, p_bank_reference, p_alt_reference, p_account_reference, p_payment_code, p_unit_code,
                p_amount, p_paid_at, p_payer_name, p_payer_phone, p_narration, p_source, 'duplicate',
                'Already received from the other Equity source', p_raw
            )
            ON CONFLICT (provider, bank_reference) DO NOTHING;

            RETURN QUERY SELECT 'duplicate'::TEXT, v_twin_id;
            RETURN;
        END IF;
    END IF;

    INSERT INTO bank_transactions (
        provider, bank_reference, alt_reference, account_reference, payment_code, unit_code,
        amount, paid_at, payer_name, payer_phone, narration, source, raw
    ) VALUES (
        p_provider, p_bank_reference, p_alt_reference, p_account_reference, p_payment_code, p_unit_code,
        p_amount, p_paid_at, p_payer_name, p_payer_phone, p_narration, p_source, p_raw
    )
    ON CONFLICT (provider, bank_reference) DO NOTHING
    RETURNING id INTO v_tx_id;

    IF v_tx_id IS NULL THEN
        RETURN QUERY SELECT 'duplicate'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    v_paid_date := (COALESCE(p_paid_at, NOW()) AT TIME ZONE 'Africa/Nairobi')::DATE;

    IF p_payment_code IS NULL OR p_unit_code IS NULL THEN
        UPDATE bank_transactions
           SET match_error = 'No account reference in the CODE#UNIT format'
         WHERE id = v_tx_id;
        RETURN QUERY SELECT 'unmatched'::TEXT, v_tx_id;
        RETURN;
    END IF;

    SELECT id, owner_id INTO v_property
      FROM properties
     WHERE UPPER(payment_code) = UPPER(p_payment_code)
       AND is_archived = FALSE
     LIMIT 1;

    IF NOT FOUND THEN
        UPDATE bank_transactions
           SET match_error = format('No property uses payment code %s', UPPER(p_payment_code))
         WHERE id = v_tx_id;
        RETURN QUERY SELECT 'unmatched'::TEXT, v_tx_id;
        RETURN;
    END IF;

    UPDATE bank_transactions
       SET owner_id = v_property.owner_id, property_id = v_property.id
     WHERE id = v_tx_id;

    -- Unit numbers are compared ignoring case, spaces and punctuation (A1 = a-1 = "A 1")
    SELECT id INTO v_unit_id
      FROM units
     WHERE property_id = v_property.id
       AND UPPER(regexp_replace(unit_number, '[^A-Za-z0-9]', '', 'g'))
         = UPPER(regexp_replace(p_unit_code, '[^A-Za-z0-9]', '', 'g'))
     ORDER BY is_archived
     LIMIT 1;

    IF v_unit_id IS NULL THEN
        UPDATE bank_transactions
           SET match_error = format('Unit %s not found in this property', UPPER(p_unit_code))
         WHERE id = v_tx_id;
        RETURN QUERY SELECT 'unmatched'::TEXT, v_tx_id;
        RETURN;
    END IF;

    UPDATE bank_transactions SET unit_id = v_unit_id WHERE id = v_tx_id;

    SELECT id INTO v_lease_id
      FROM leases
     WHERE unit_id = v_unit_id AND status = 'active'
     ORDER BY start_date DESC
     LIMIT 1;

    IF v_lease_id IS NULL THEN
        UPDATE bank_transactions
           SET match_error = format('Unit %s has no active lease', UPPER(p_unit_code))
         WHERE id = v_tx_id;
        RETURN QUERY SELECT 'unmatched'::TEXT, v_tx_id;
        RETURN;
    END IF;

    -- Apply to the oldest unpaid rent first
    v_remaining := p_amount;

    FOR v_pay IN
        SELECT id, amount, late_fee, amount_paid
          FROM payments
         WHERE lease_id = v_lease_id
           AND status IN ('pending', 'overdue', 'partial')
         ORDER BY due_date ASC, created_at ASC
         FOR UPDATE
    LOOP
        EXIT WHEN v_remaining <= 0;

        v_due := v_pay.amount + COALESCE(v_pay.late_fee, 0) - COALESCE(v_pay.amount_paid, 0);
        IF v_due <= 0 THEN
            CONTINUE;
        END IF;

        v_apply := LEAST(v_remaining, v_due);

        UPDATE payments
           SET amount_paid = COALESCE(amount_paid, 0) + v_apply,
               status = (CASE WHEN v_apply >= v_due THEN 'paid' ELSE 'partial' END)::payment_status,
               paid_date = CASE WHEN v_apply >= v_due THEN v_paid_date ELSE paid_date END,
               payment_method = 'equity_bank',
               transaction_reference = CASE
                   WHEN transaction_reference IS NULL OR transaction_reference = '' THEN p_bank_reference
                   ELSE transaction_reference || ', ' || p_bank_reference
               END,
               notes = concat_ws(E'\n', NULLIF(notes, ''),
                   format('Ksh %s received via Equity Bank (%s) on %s', v_apply, p_bank_reference, v_paid_date)),
               updated_at = NOW()
         WHERE id = v_pay.id;

        v_remaining := v_remaining - v_apply;
    END LOOP;

    -- Nothing outstanding (or an overpayment): keep the money visible as a paid
    -- advance on the lease rather than dropping it.
    IF v_remaining > 0 THEN
        INSERT INTO payments (
            lease_id, amount, amount_paid, due_date, paid_date, status,
            payment_method, transaction_reference, late_fee, notes
        ) VALUES (
            v_lease_id, v_remaining, v_remaining, v_paid_date, v_paid_date, 'paid',
            'equity_bank', p_bank_reference, 0,
            format('Advance payment: Ksh %s received via Equity Bank (%s) with no rent outstanding', v_remaining, p_bank_reference)
        );
    END IF;

    UPDATE bank_transactions
       SET status = 'matched', lease_id = v_lease_id, match_error = NULL, updated_at = NOW()
     WHERE id = v_tx_id;

    RETURN QUERY SELECT 'matched'::TEXT, v_tx_id;
END;
$$;

REVOKE ALL ON FUNCTION record_bank_payment(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_bank_payment(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, JSONB) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION record_bank_payment(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;
