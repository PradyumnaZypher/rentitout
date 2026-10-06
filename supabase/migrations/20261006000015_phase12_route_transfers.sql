-- Phase 12: Route Sandbox Transfer & Settlement Engine

-- 1. Create the transfer tracking table
CREATE TABLE IF NOT EXISTS route_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payout_profile_id uuid NOT NULL REFERENCES payout_profiles(owner_id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'razorpay',
  provider_transfer_id text UNIQUE,
  provider_account_id text NOT NULL,
  amount numeric NOT NULL, -- Gross booking amount
  currency text NOT NULL DEFAULT 'INR',
  platform_fee numeric NOT NULL,
  owner_amount numeric NOT NULL, -- amount - platform_fee
  status text NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'PENDING', 'PROCESSED', 'FAILED', 'REVERSED', 'PARTIALLY_REVERSED')),
  settlement_status text NOT NULL DEFAULT 'PENDING' CHECK (settlement_status IN ('PENDING', 'ON_HOLD', 'SETTLED')),
  on_hold boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  failed_at timestamptz,
  reversed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Ensure a single booking can only generate ONE transfer (to prevent double-payment)
CREATE UNIQUE INDEX idx_route_transfers_booking ON route_transfers(booking_id);

-- RLS
ALTER TABLE route_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own transfers" ON route_transfers
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);

-- 2. Expand Financial Ledger events
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
      'REFUND_FAILED',
      'TRANSFER_CREATED',
      'TRANSFER_PROCESSED',
      'TRANSFER_FAILED',
      'TRANSFER_REVERSED',
      'SETTLEMENT_RELEASED',
      'OWNER_SETTLED'
  ));

-- 3. Secure Server-Side Function to calculate transfer eligibility
CREATE OR REPLACE FUNCTION get_transfer_eligibility(p_booking_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_booking record;
  v_payment record;
  v_profile record;
  v_commission numeric;
  v_owner_amount numeric;
  v_existing_transfer record;
BEGIN
  -- Authenticate
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Load booking
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  IF v_booking IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Ensure booking belongs to the caller's listing
  IF NOT EXISTS (SELECT 1 FROM listings WHERE id = v_booking.listing_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Verify booking conditions
  IF v_booking.status != 'COMPLETED' OR v_booking.payment_status != 'PAID' THEN
    RAISE EXCEPTION 'Booking is not eligible for transfer';
  END IF;

  -- Find payment
  SELECT * INTO v_payment FROM payments WHERE booking_id = p_booking_id AND status = 'PAID' LIMIT 1;
  IF v_payment IS NULL THEN
    RAISE EXCEPTION 'No valid payment found';
  END IF;

  -- Check existing transfer to prevent duplicates
  SELECT * INTO v_existing_transfer FROM route_transfers WHERE booking_id = p_booking_id;
  IF v_existing_transfer IS NOT NULL THEN
    RAISE EXCEPTION 'A transfer has already been initiated for this booking';
  END IF;

  -- Check payout profile
  SELECT * INTO v_profile FROM payout_profiles WHERE owner_id = auth.uid();
  IF v_profile IS NULL OR v_profile.kyc_status NOT IN ('ACTIVE', 'VERIFIED') OR v_profile.provider_account_id IS NULL THEN
    RAISE EXCEPTION 'Payout account is not active';
  END IF;

  -- Calculate commission based on Phase 11 helper
  v_commission := calculate_commission(v_payment.amount);
  v_owner_amount := v_payment.amount - v_commission;

  RETURN jsonb_build_object(
    'is_eligible', true,
    'payment_id', v_payment.id,
    'provider_order_id', v_payment.provider_order_id,
    'provider_payment_id', v_payment.provider_payment_id,
    'provider_account_id', v_profile.provider_account_id,
    'gross_amount', v_payment.amount,
    'commission', v_commission,
    'owner_amount', v_owner_amount,
    'currency', v_payment.currency
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. RPC to securely store created transfer record (from Edge Function)
CREATE OR REPLACE FUNCTION record_route_transfer(
  p_booking_id uuid,
  p_payment_id uuid,
  p_owner_id uuid,
  p_provider_transfer_id text,
  p_provider_account_id text,
  p_gross_amount numeric,
  p_commission numeric,
  p_owner_amount numeric,
  p_currency text
)
RETURNS boolean AS $$
DECLARE
  v_listing record;
BEGIN
  -- Service role only
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Insert the transfer record
  INSERT INTO route_transfers (
    booking_id,
    payment_id,
    owner_id,
    payout_profile_id,
    provider_transfer_id,
    provider_account_id,
    amount,
    currency,
    platform_fee,
    owner_amount,
    status,
    settlement_status,
    on_hold
  ) VALUES (
    p_booking_id,
    p_payment_id,
    p_owner_id,
    p_owner_id, -- owner_id is the primary key of payout_profiles
    p_provider_transfer_id,
    p_provider_account_id,
    p_gross_amount,
    p_currency,
    p_commission,
    p_owner_amount,
    'CREATED',
    'ON_HOLD',
    true
  );

  -- Log into financial ledger
  SELECT * INTO v_listing FROM listings WHERE id = (SELECT listing_id FROM bookings WHERE id = p_booking_id);

  INSERT INTO financial_ledger (
    booking_id,
    payment_id,
    listing_id,
    owner_id,
    renter_id,
    event_type,
    amount,
    currency,
    description
  ) VALUES (
    p_booking_id,
    p_payment_id,
    v_listing.id,
    p_owner_id,
    (SELECT renter_id FROM bookings WHERE id = p_booking_id),
    'TRANSFER_CREATED',
    p_owner_amount,
    p_currency,
    'Razorpay Route transfer created on hold'
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. RPC to handle Transfer Webhook Updates securely
CREATE OR REPLACE FUNCTION update_route_transfer_status(
  p_provider_transfer_id text,
  p_new_status text
)
RETURNS boolean AS $$
DECLARE
  v_transfer record;
  v_event_type text;
BEGIN
  -- Service role only
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_transfer FROM route_transfers WHERE provider_transfer_id = p_provider_transfer_id;
  IF v_transfer IS NULL THEN
    RETURN false;
  END IF;

  -- Map new status and event type
  IF p_new_status = 'PROCESSED' THEN
    v_event_type := 'TRANSFER_PROCESSED';
    UPDATE route_transfers SET status = p_new_status, processed_at = now(), updated_at = now() WHERE id = v_transfer.id;
  ELSIF p_new_status = 'FAILED' THEN
    v_event_type := 'TRANSFER_FAILED';
    UPDATE route_transfers SET status = p_new_status, failed_at = now(), updated_at = now() WHERE id = v_transfer.id;
  ELSIF p_new_status = 'REVERSED' THEN
    v_event_type := 'TRANSFER_REVERSED';
    UPDATE route_transfers SET status = p_new_status, reversed_at = now(), updated_at = now() WHERE id = v_transfer.id;
  ELSE
    UPDATE route_transfers SET status = p_new_status, updated_at = now() WHERE id = v_transfer.id;
    RETURN true;
  END IF;

  -- Prevent duplicate ledger events
  IF NOT EXISTS (
    SELECT 1 FROM financial_ledger 
    WHERE booking_id = v_transfer.booking_id AND event_type = v_event_type
  ) THEN
    INSERT INTO financial_ledger (
      booking_id,
      payment_id,
      listing_id,
      owner_id,
      renter_id,
      event_type,
      amount,
      currency,
      description
    ) VALUES (
      v_transfer.booking_id,
      v_transfer.payment_id,
      (SELECT listing_id FROM bookings WHERE id = v_transfer.booking_id),
      v_transfer.owner_id,
      (SELECT renter_id FROM bookings WHERE id = v_transfer.booking_id),
      v_event_type,
      v_transfer.owner_amount,
      v_transfer.currency,
      'Provider webhook triggered transfer status update'
    );
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
