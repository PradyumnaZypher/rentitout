-- Phase 13: Financial Reconciliation & Transaction Control Plane

-- 1. Create Reconciliation Table
CREATE TABLE IF NOT EXISTS financial_reconciliation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE UNIQUE,
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  route_transfer_id uuid REFERENCES route_transfers(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_state text,
  transfer_state text,
  settlement_state text,
  ledger_state text,
  reconciliation_status text NOT NULL DEFAULT 'PENDING' CHECK (reconciliation_status IN ('MATCHED', 'PENDING', 'DISCREPANCY', 'FAILED', 'UNKNOWN')),
  discrepancy_type text,
  discrepancy_message text,
  last_checked_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_reconciliation_status ON financial_reconciliation(reconciliation_status);
CREATE INDEX idx_reconciliation_owner ON financial_reconciliation(owner_id);

-- RLS
ALTER TABLE financial_reconciliation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own reconciliation" ON financial_reconciliation
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);

-- No INSERT/UPDATE/DELETE policies for normal users. Only server-side RPCs update this.

-- 2. Secure Server-Side Function to check booking financials
CREATE OR REPLACE FUNCTION reconcile_booking_financials(p_booking_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_booking record;
  v_payment record;
  v_transfer record;
  v_listing record;
  v_profile record;
  
  v_has_payment_event boolean := false;
  v_has_entitlement_event boolean := false;
  v_has_transfer_event boolean := false;
  v_has_settlement_event boolean := false;
  
  v_status text := 'PENDING';
  v_type text := NULL;
  v_msg text := NULL;
  
  v_expected_commission numeric;
BEGIN
  -- Service role only for mutation/checking
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 1. Fetch Booking & Listing
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  IF v_booking IS NULL THEN
    RETURN jsonb_build_object('error', 'Booking not found');
  END IF;

  SELECT * INTO v_listing FROM listings WHERE id = v_booking.listing_id;

  -- 2. Fetch Payment
  SELECT * INTO v_payment FROM payments WHERE booking_id = p_booking_id ORDER BY created_at DESC LIMIT 1;
  
  -- 3. Fetch Transfer
  SELECT * INTO v_transfer FROM route_transfers WHERE booking_id = p_booking_id;
  
  -- 4. Fetch Profile
  SELECT * INTO v_profile FROM payout_profiles WHERE owner_id = v_listing.owner_id;

  -- 5. Ledger Checks
  v_has_payment_event := EXISTS(SELECT 1 FROM financial_ledger WHERE booking_id = p_booking_id AND event_type = 'PAYMENT_COLLECTED');
  v_has_entitlement_event := EXISTS(SELECT 1 FROM financial_ledger WHERE booking_id = p_booking_id AND event_type = 'OWNER_ENTITLEMENT_CREATED');
  v_has_transfer_event := EXISTS(SELECT 1 FROM financial_ledger WHERE booking_id = p_booking_id AND event_type = 'TRANSFER_CREATED');
  v_has_settlement_event := EXISTS(SELECT 1 FROM financial_ledger WHERE booking_id = p_booking_id AND event_type = 'OWNER_SETTLED');

  -- --- RECONCILIATION LOGIC ---

  IF v_booking.status != 'COMPLETED' THEN
    v_status := 'PENDING';
    v_msg := 'Booking not completed';
  ELSIF v_payment IS NULL THEN
    v_status := 'DISCREPANCY';
    v_type := 'PAYMENT_MISMATCH';
    v_msg := 'Booking is completed but no payment record exists';
  ELSIF v_payment.status != 'PAID' THEN
    v_status := 'DISCREPANCY';
    v_type := 'PAYMENT_MISMATCH';
    v_msg := 'Booking is completed but payment is not PAID';
  ELSIF v_booking.total_price != v_payment.amount THEN
    v_status := 'DISCREPANCY';
    v_type := 'AMOUNT_MISMATCH';
    v_msg := 'Booking total price does not match payment amount';
  ELSIF NOT v_has_payment_event THEN
    v_status := 'DISCREPANCY';
    v_type := 'LEDGER_MISMATCH';
    v_msg := 'Missing PAYMENT_COLLECTED ledger event';
  ELSIF NOT v_has_entitlement_event THEN
    v_status := 'DISCREPANCY';
    v_type := 'LEDGER_MISMATCH';
    v_msg := 'Missing OWNER_ENTITLEMENT_CREATED ledger event';
  ELSIF v_transfer IS NULL THEN
    v_status := 'PENDING';
    v_msg := 'Transfer not yet created';
  ELSIF v_transfer.amount != v_payment.amount THEN
    v_status := 'DISCREPANCY';
    v_type := 'AMOUNT_MISMATCH';
    v_msg := 'Transfer gross amount does not match payment amount';
  ELSE
    -- Calculate expected commission
    v_expected_commission := calculate_commission(v_payment.amount);
    
    IF v_transfer.platform_fee != v_expected_commission THEN
      v_status := 'DISCREPANCY';
      v_type := 'AMOUNT_MISMATCH';
      v_msg := 'Transfer commission does not match expected commission';
    ELSIF v_transfer.owner_amount != (v_transfer.amount - v_transfer.platform_fee) THEN
      v_status := 'DISCREPANCY';
      v_type := 'AMOUNT_MISMATCH';
      v_msg := 'Transfer owner amount does not equal gross minus commission';
    ELSIF v_transfer.provider_account_id != v_profile.provider_account_id THEN
      v_status := 'DISCREPANCY';
      v_type := 'PROVIDER_ACCOUNT_MISMATCH';
      v_msg := 'Transfer provider account does not match owner current payout profile';
    ELSIF v_transfer.owner_id != v_listing.owner_id THEN
      v_status := 'DISCREPANCY';
      v_type := 'TRANSFER_MISMATCH';
      v_msg := 'Transfer owner does not match listing owner';
    ELSIF NOT v_has_transfer_event THEN
      v_status := 'DISCREPANCY';
      v_type := 'LEDGER_MISMATCH';
      v_msg := 'Missing TRANSFER_CREATED ledger event';
    ELSIF v_transfer.status = 'FAILED' THEN
      v_status := 'FAILED';
      v_msg := 'Transfer failed at provider';
    ELSIF v_transfer.status = 'REVERSED' THEN
      v_status := 'FAILED';
      v_msg := 'Transfer reversed at provider';
    ELSIF v_transfer.settlement_status = 'SETTLED' AND NOT v_has_settlement_event THEN
      v_status := 'DISCREPANCY';
      v_type := 'LEDGER_MISMATCH';
      v_msg := 'Transfer is SETTLED but missing OWNER_SETTLED ledger event';
    ELSIF v_transfer.settlement_status = 'SETTLED' THEN
      v_status := 'MATCHED';
      v_msg := 'Successfully settled';
    ELSIF v_transfer.status = 'PROCESSED' THEN
      v_status := 'PENDING';
      v_msg := 'Transfer processed, awaiting settlement';
    ELSE
      v_status := 'PENDING';
      v_msg := 'Transfer pending provider processing';
    END IF;
  END IF;

  -- Upsert reconciliation record
  INSERT INTO financial_reconciliation (
    booking_id,
    payment_id,
    route_transfer_id,
    owner_id,
    payment_state,
    transfer_state,
    settlement_state,
    reconciliation_status,
    discrepancy_type,
    discrepancy_message,
    last_checked_at,
    updated_at
  ) VALUES (
    p_booking_id,
    v_payment.id,
    v_transfer.id,
    v_listing.owner_id,
    v_payment.status,
    v_transfer.status,
    v_transfer.settlement_status,
    v_status,
    v_type,
    v_msg,
    now(),
    now()
  )
  ON CONFLICT (booking_id) DO UPDATE SET
    payment_id = EXCLUDED.payment_id,
    route_transfer_id = EXCLUDED.route_transfer_id,
    payment_state = EXCLUDED.payment_state,
    transfer_state = EXCLUDED.transfer_state,
    settlement_state = EXCLUDED.settlement_state,
    reconciliation_status = EXCLUDED.reconciliation_status,
    discrepancy_type = EXCLUDED.discrepancy_type,
    discrepancy_message = EXCLUDED.discrepancy_message,
    last_checked_at = EXCLUDED.last_checked_at,
    updated_at = now();

  RETURN jsonb_build_object(
    'status', v_status,
    'type', v_type,
    'message', v_msg
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Batch Reconciliation RPC
CREATE OR REPLACE FUNCTION reconcile_pending_financials(p_limit int DEFAULT 50)
RETURNS jsonb AS $$
DECLARE
  v_booking record;
  v_count int := 0;
  v_discrepancies int := 0;
  v_result jsonb;
BEGIN
  -- Service role only
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  FOR v_booking IN 
    SELECT b.id FROM bookings b
    LEFT JOIN financial_reconciliation fr ON fr.booking_id = b.id
    WHERE (b.status IN ('COMPLETED', 'ACCEPTED'))
      AND (fr.reconciliation_status IS NULL OR fr.reconciliation_status IN ('PENDING', 'DISCREPANCY'))
      AND (fr.last_checked_at IS NULL OR fr.last_checked_at < now() - interval '1 hour')
    ORDER BY b.updated_at ASC
    LIMIT p_limit
  LOOP
    v_result := reconcile_booking_financials(v_booking.id);
    v_count := v_count + 1;
    IF v_result->>'status' = 'DISCREPANCY' THEN
      v_discrepancies := v_discrepancies + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', v_count,
    'discrepancies_found', v_discrepancies
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
