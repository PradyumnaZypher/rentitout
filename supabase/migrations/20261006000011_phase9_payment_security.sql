-- Phase 9: Payment Security & Webhook Handling

-- 1. Create a function strictly for Service Role (Edge Functions) to mark a payment as PAID
-- This replaces the browser-callable verify_payment_success which relied on mock verification.
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
  
  -- 5. Notification
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

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke execute on the old vulnerable function from public/authenticated users
-- (Actually, we can just drop it to avoid confusion)
DROP FUNCTION IF EXISTS verify_payment_success;

-- 2. Update initiate_payment_order to just return the necessary booking info so Edge Function can create the order
-- We need the Edge Function to create the Razorpay order FIRST, then create the payment record with the real order_id.
-- Let's create an RPC that validates and returns the amount, but doesn't create the payment yet.
CREATE OR REPLACE FUNCTION get_booking_for_payment(p_booking_id uuid)
RETURNS json AS $$
DECLARE
  v_booking record;
BEGIN
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

  RETURN json_build_object(
    'booking_id', v_booking.id,
    'amount', v_booking.total_price,
    'user_id', v_booking.renter_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- The Edge Function will:
-- 1. Call get_booking_for_payment(booking_id) as the authenticated user.
-- 2. If valid, call Razorpay API to create an order for that amount.
-- 3. Use the service_role key to INSERT into payments with the razorpay_order_id.
-- 4. Return the razorpay_order_id and amount to the frontend to launch checkout.

-- Therefore, we don't strictly need initiate_payment_order anymore. We can keep it or let the Edge Function insert directly.
-- But we should grant service_role permission to insert into payments (which it inherently has).
