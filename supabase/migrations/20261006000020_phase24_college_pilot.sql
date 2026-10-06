-- Phase 24: Reversible College Pilot Mode

-- 1. Add payment_method to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'ONLINE';
-- Values expected: 'ONLINE', 'CASH'

-- 2. Feedback Table
CREATE TABLE IF NOT EXISTS platform_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'GENERAL',
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'NEW',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_feedback_user_id_idx ON platform_feedback(user_id);
CREATE INDEX IF NOT EXISTS platform_feedback_status_idx ON platform_feedback(status);

ALTER TABLE platform_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback" ON platform_feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own feedback" ON platform_feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3. RPCs for Mutual Cash Confirmation

CREATE OR REPLACE FUNCTION report_cash_paid(p_booking_id uuid)
RETURNS void AS $$
DECLARE
  v_booking record;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  IF v_booking IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;
  IF v_booking.renter_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Only renter can report cash paid';
  END IF;
  IF v_booking.payment_method != 'CASH' THEN
    RAISE EXCEPTION 'Booking is not a cash transaction';
  END IF;
  IF v_booking.payment_status NOT IN ('UNPAID', 'CASH_PENDING') THEN
    RAISE EXCEPTION 'Invalid payment status for reporting cash';
  END IF;

  UPDATE bookings 
  SET payment_status = 'CASH_REPORTED_PAID', updated_at = now() 
  WHERE id = p_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION confirm_cash_received(p_booking_id uuid)
RETURNS void AS $$
DECLARE
  v_booking record;
  v_listing record;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  IF v_booking IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;
  
  SELECT * INTO v_listing FROM listings WHERE id = v_booking.listing_id;
  IF v_listing.owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Only owner can confirm cash received';
  END IF;

  IF v_booking.payment_method != 'CASH' THEN
    RAISE EXCEPTION 'Booking is not a cash transaction';
  END IF;
  
  IF v_booking.payment_status != 'CASH_REPORTED_PAID' THEN
    RAISE EXCEPTION 'Renter has not reported cash as paid yet';
  END IF;

  UPDATE bookings 
  SET payment_status = 'CASH_CONFIRMED_RECEIVED', updated_at = now() 
  WHERE id = p_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
