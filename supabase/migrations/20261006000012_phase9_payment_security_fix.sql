-- Phase 9 Security Fix

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

  -- CRITICAL SECURITY FIX: Ensure the provider_order_id matches what was originally created!
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
  
  -- Prevent duplicate execution of subsequent logic (like notifications) in a race condition
  IF v_updated_id IS NULL THEN
    RETURN true;
  END IF;
  
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
