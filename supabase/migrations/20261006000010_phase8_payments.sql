-- Phase 8: Payment Architecture

-- 1. Add payment status to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'UNPAID';

-- 2. Create Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'razorpay',
  provider_order_id text UNIQUE,
  provider_payment_id text UNIQUE,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'CREATED', -- CREATED, PENDING, PAID, FAILED, CANCELLED, REFUNDED
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  paid_at timestamptz
);

-- 3. RLS Policies for Payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Renters can view their own payments
CREATE POLICY "Users can view own payments" ON payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Owners can view payments for their listings
CREATE POLICY "Owners can view listing payments" ON payments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE b.id = payments.booking_id AND l.owner_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies for normal users!
-- Payments must be modified exclusively through server-side RPCs.

-- 4. Payment triggers to protect mutability
CREATE OR REPLACE FUNCTION restrict_payment_update()
RETURNS trigger AS $$
BEGIN
  -- Prevent status changing away from PAID by normal users
  IF OLD.status = 'PAID' AND NEW.status != 'PAID' THEN
    IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
      RAISE EXCEPTION 'Cannot modify a paid transaction directly';
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_restrict_payment_update ON payments;
CREATE TRIGGER trigger_restrict_payment_update
BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE PROCEDURE restrict_payment_update();


-- 5. Secure RPC to initiate a payment order (Mocking backend order creation)
CREATE OR REPLACE FUNCTION initiate_payment_order(p_booking_id uuid)
RETURNS uuid AS $$
DECLARE
  v_booking record;
  v_payment_id uuid;
BEGIN
  -- Verify booking and ownership
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  IF v_booking IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;
  
  IF v_booking.renter_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Not your booking';
  END IF;
  
  IF v_booking.status != 'ACCEPTED' THEN
    RAISE EXCEPTION 'Booking is not in ACCEPTED state';
  END IF;
  
  IF v_booking.payment_status = 'PAID' THEN
    RAISE EXCEPTION 'Booking is already paid';
  END IF;

  -- Create payment record based on authoritative database total_price
  -- In a real scenario, this would be an Edge Function that talks to Razorpay,
  -- gets an order_id, and stores it. Here, we create the initial record.
  INSERT INTO payments (booking_id, user_id, amount, status)
  VALUES (p_booking_id, auth.uid(), v_booking.total_price, 'CREATED')
  RETURNING id INTO v_payment_id;
  
  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 6. Secure RPC to verify and complete payment
CREATE OR REPLACE FUNCTION verify_payment_success(
  p_payment_id uuid,
  p_provider_payment_id text,
  p_provider_order_id text,
  p_signature text
)
RETURNS boolean AS $$
DECLARE
  v_payment record;
BEGIN
  -- 1. Locate payment safely
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;
  IF v_payment IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  
  IF v_payment.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  IF v_payment.status = 'PAID' THEN
    RETURN true; -- Idempotent return
  END IF;

  -- 2. VERIFY SIGNATURE (Mock implementation)
  -- In production, an Edge Function would use the Razorpay SDK to cryptographically verify:
  -- hmac_sha256(p_provider_order_id + "|" + p_provider_payment_id, secret) == p_signature
  IF p_signature IS NULL OR p_signature = '' THEN
    RAISE EXCEPTION 'Invalid signature';
  END IF;

  -- 3. Atomic update of payment state
  UPDATE payments 
  SET status = 'PAID',
      provider_payment_id = p_provider_payment_id,
      provider_order_id = p_provider_order_id,
      paid_at = now()
  WHERE id = p_payment_id AND status != 'PAID';
  
  -- 4. Atomic update of booking state
  UPDATE bookings
  SET payment_status = 'PAID'
  WHERE id = v_payment.booking_id;
  
  -- 5. Notification (Owner receives payment confirmation)
  -- Assuming create_notification exists from Phase 7
  -- Get listing info
  DECLARE
    v_booking record;
    v_listing record;
  BEGIN
    SELECT * INTO v_booking FROM bookings WHERE id = v_payment.booking_id;
    SELECT * INTO v_listing FROM listings WHERE id = v_booking.listing_id;
    
    PERFORM create_notification(
      v_listing.owner_id,
      'PAYMENT_RECEIVED',
      'Payment Received',
      'Payment of ₹' || v_payment.amount || ' received for ' || v_listing.title,
      'booking',
      v_booking.id
    );
  END;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
