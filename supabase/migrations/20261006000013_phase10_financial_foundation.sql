-- Phase 10: Escrow & Owner Payout Foundation

-- 1. Create Immutable Financial Ledger
-- This acts as the append-only source of truth for financial movements,
-- separating the fact that money was collected from the right to receive it.
CREATE TABLE IF NOT EXISTS financial_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  renter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (
    event_type IN (
      'PAYMENT_COLLECTED', 
      'OWNER_ENTITLEMENT_CREATED', 
      'PAYOUT_INITIATED', 
      'PAYOUT_SUCCESS', 
      'PAYOUT_FAILED',
      'REFUND_REQUESTED',
      'REFUND_SUCCESS',
      'REFUND_FAILED',
      'COMMISSION_DEDUCTED'
    )
  ),
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexing for fast financial aggregations
CREATE INDEX idx_financial_ledger_owner ON financial_ledger(owner_id);
CREATE INDEX idx_financial_ledger_booking ON financial_ledger(booking_id);
CREATE INDEX idx_financial_ledger_event ON financial_ledger(event_type);

-- RLS: Only involved parties can read. NO ONE can insert/update/delete directly from the client.
ALTER TABLE financial_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own ledger entries" ON financial_ledger
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);

CREATE POLICY "Renters can view own ledger entries" ON financial_ledger
  FOR SELECT TO authenticated USING (auth.uid() = renter_id);

-- Prevent any UPDATE or DELETE at the database level to ensure immutability
CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Financial ledger entries are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_immutable_ledger
BEFORE UPDATE OR DELETE ON financial_ledger
FOR EACH ROW EXECUTE PROCEDURE prevent_ledger_mutation();


-- 2. Payout Profiles (Foundation only, no real routing yet)
-- This tracks if an owner has successfully onboarded with Razorpay KYC
CREATE TABLE IF NOT EXISTS payout_profiles (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'razorpay',
  provider_account_id text UNIQUE, -- e.g., Razorpay Route Linked Account ID
  kyc_status text NOT NULL DEFAULT 'PENDING' CHECK (kyc_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payout_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own payout profile" ON payout_profiles
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);


-- 3. Trigger to automatically record Owner Entitlement when booking completes
CREATE OR REPLACE FUNCTION handle_booking_completion_financials()
RETURNS trigger AS $$
DECLARE
  v_listing record;
BEGIN
  -- When booking transitions to COMPLETED and was PAID
  IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' AND NEW.payment_status = 'PAID' THEN
    
    -- Ensure idempotency (don't create if it already exists)
    IF NOT EXISTS (
      SELECT 1 FROM financial_ledger 
      WHERE booking_id = NEW.id AND event_type = 'OWNER_ENTITLEMENT_CREATED'
    ) THEN
      
      SELECT * INTO v_listing FROM listings WHERE id = NEW.listing_id;
      
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
        NEW.total_price, -- Gross amount (Commission architecture can deduct from this later)
        'INR',
        'Owner entitlement created for completed booking'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_booking_completion_financials
AFTER UPDATE ON bookings
FOR EACH ROW EXECUTE PROCEDURE handle_booking_completion_financials();

-- Update mark_payment_paid to log to the financial ledger
CREATE OR REPLACE FUNCTION mark_payment_paid(
  p_payment_id uuid,
  p_provider_payment_id text,
  p_provider_order_id text
)
RETURNS boolean AS $$
DECLARE
  v_payment record;
  v_booking record;
  v_listing record;
  v_updated_id uuid;
BEGIN
  -- 1. Ensure this is only called by the service_role
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only backend services can mark payments paid';
  END IF;

  -- 2. Locate payment safely
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;
  IF v_payment IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  
  IF v_payment.status = 'PAID' THEN
    RETURN true; -- Idempotent return for webhooks
  END IF;

  -- CRITICAL SECURITY FIX (from Phase 9.1): Ensure the provider_order_id matches
  IF v_payment.provider_order_id != p_provider_order_id THEN
    RAISE EXCEPTION 'Security error: Order ID mismatch';
  END IF;

  -- 3. Atomic update of payment state
  UPDATE payments 
  SET status = 'PAID',
      provider_payment_id = p_provider_payment_id,
      paid_at = now()
  WHERE id = p_payment_id AND status != 'PAID'
  RETURNING id INTO v_updated_id;
  
  -- Prevent duplicate execution in a race condition
  IF v_updated_id IS NULL THEN
    RETURN true;
  END IF;
  
  -- 4. Atomic update of booking state
  UPDATE bookings
  SET payment_status = 'PAID'
  WHERE id = v_payment.booking_id;
  
  -- 5. Add to immutable financial ledger
  SELECT * INTO v_booking FROM bookings WHERE id = v_payment.booking_id;
  SELECT * INTO v_listing FROM listings WHERE id = v_booking.listing_id;
  
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
    v_booking.id,
    p_payment_id,
    v_listing.id,
    v_listing.owner_id,
    v_booking.renter_id,
    'PAYMENT_COLLECTED',
    v_payment.amount,
    v_payment.currency,
    'Payment successfully collected and verified via provider'
  );
  
  -- 6. Notification
  PERFORM create_notification(
    v_listing.owner_id,
    'PAYMENT_RECEIVED',
    'Payment Received',
    'Payment of ₹' || v_payment.amount || ' received for ' || v_listing.title,
    'booking',
    v_booking.id
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
