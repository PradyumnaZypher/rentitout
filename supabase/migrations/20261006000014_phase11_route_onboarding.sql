-- Phase 11: Route Onboarding & Platform Commission

-- 1. Extend payout_profiles status constraint
ALTER TABLE payout_profiles DROP CONSTRAINT payout_profiles_kyc_status_check;
ALTER TABLE payout_profiles ADD CONSTRAINT payout_profiles_kyc_status_check 
  CHECK (kyc_status IN ('NOT_STARTED', 'PENDING', 'UNDER_REVIEW', 'NEEDS_CLARIFICATION', 'ACTIVE', 'VERIFIED', 'REJECTED', 'FAILED'));

ALTER TABLE payout_profiles ALTER COLUMN kyc_status SET DEFAULT 'NOT_STARTED';

-- 2. Platform Settings for Commission
CREATE TABLE IF NOT EXISTS platform_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  platform_fee_bps integer NOT NULL DEFAULT 500 CHECK (platform_fee_bps >= 0 AND platform_fee_bps <= 10000),
  updated_at timestamptz DEFAULT now()
);

-- Insert default 5% fee (500 basis points)
INSERT INTO platform_settings (id, platform_fee_bps) VALUES (1, 500) ON CONFLICT DO NOTHING;

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform settings viewable by everyone" ON platform_settings
  FOR SELECT TO authenticated USING (true);

-- 3. Extend financial ledger constraint for Commission types
ALTER TABLE financial_ledger DROP CONSTRAINT financial_ledger_event_type_check;
ALTER TABLE financial_ledger ADD CONSTRAINT financial_ledger_event_type_check
  CHECK (event_type IN (
      'PAYMENT_COLLECTED', 
      'OWNER_ENTITLEMENT_CREATED',
      'COMMISSION_CALCULATED',
      'COMMISSION_DEDUCTED',
      'PAYOUT_INITIATED', 
      'PAYOUT_SUCCESS', 
      'PAYOUT_FAILED',
      'REFUND_REQUESTED',
      'REFUND_SUCCESS',
      'REFUND_FAILED'
  ));

-- 4. Secure RPC to update payout profile status (For Webhook)
CREATE OR REPLACE FUNCTION update_payout_profile_status(
  p_provider_account_id text,
  p_new_status text
)
RETURNS boolean AS $$
BEGIN
  -- Ensure only service_role (Edge Functions) can call this
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE payout_profiles
  SET kyc_status = p_new_status,
      updated_at = now()
  WHERE provider_account_id = p_provider_account_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Calculate Commission Helper
CREATE OR REPLACE FUNCTION calculate_commission(p_amount numeric)
RETURNS numeric AS $$
DECLARE
  v_bps integer;
BEGIN
  SELECT platform_fee_bps INTO v_bps FROM platform_settings WHERE id = 1;
  IF v_bps IS NULL THEN
    v_bps := 500; -- fallback 5%
  END IF;
  
  -- Return exact integer precision for paise
  RETURN ROUND((p_amount * v_bps) / 10000.0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Modify the booking completion trigger to also calculate commission
CREATE OR REPLACE FUNCTION handle_booking_completion_financials()
RETURNS trigger AS $$
DECLARE
  v_listing record;
  v_commission numeric;
BEGIN
  -- When booking transitions to COMPLETED and was PAID
  IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' AND NEW.payment_status = 'PAID' THEN
    
    -- Ensure idempotency
    IF NOT EXISTS (
      SELECT 1 FROM financial_ledger 
      WHERE booking_id = NEW.id AND event_type = 'OWNER_ENTITLEMENT_CREATED'
    ) THEN
      
      SELECT * INTO v_listing FROM listings WHERE id = NEW.listing_id;
      
      -- Owner Entitlement (Gross)
      INSERT INTO financial_ledger (
        booking_id,
        listing_id,
        owner_id,
        renter_id,
        event_type,
        amount,
        currency,
        description
      ) VALUES (
        NEW.id,
        NEW.listing_id,
        v_listing.owner_id,
        NEW.renter_id,
        'OWNER_ENTITLEMENT_CREATED',
        NEW.total_price,
        'INR',
        'Owner entitlement created for completed booking'
      );
      
      -- Commission Calculated
      v_commission := calculate_commission(NEW.total_price);
      
      INSERT INTO financial_ledger (
        booking_id,
        listing_id,
        owner_id,
        renter_id,
        event_type,
        amount,
        currency,
        description
      ) VALUES (
        NEW.id,
        NEW.listing_id,
        v_listing.owner_id,
        NEW.renter_id,
        'COMMISSION_CALCULATED',
        v_commission,
        'INR',
        'Platform commission calculated'
      );
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
