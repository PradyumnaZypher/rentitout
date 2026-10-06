-- Phase 14: Refunds, Reversals & Financial Adjustments

-- 1. Expand ledger event types
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
      'REFUND_PROCESSING',
      'REFUND_SUCCESS',
      'REFUND_FAILED',
      'TRANSFER_CREATED',
      'TRANSFER_PROCESSED',
      'TRANSFER_FAILED',
      'TRANSFER_REVERSAL_REQUESTED',
      'TRANSFER_REVERSED',
      'SETTLEMENT_RELEASE_REQUESTED',
      'SETTLEMENT_RELEASED',
      'OWNER_SETTLED',
      'ADJUSTMENT_CREATED'
  ));

-- 2. Create Refund Requests Table
CREATE TABLE IF NOT EXISTS refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0), -- Amount in paise
  reason text,
  status text NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'PROCESSING', 'PROCESSED', 'FAILED', 'CANCELLED')),
  provider_refund_id text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX idx_refund_requests_booking ON refund_requests(booking_id);
CREATE INDEX idx_refund_requests_status ON refund_requests(status);

ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Renters can view own refunds" ON refund_requests
  FOR SELECT TO authenticated USING (requested_by = auth.uid());

CREATE POLICY "Owners can view listing refunds" ON refund_requests
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE b.id = refund_requests.booking_id AND l.owner_id = auth.uid()
    )
  );

-- 3. Create Transfer Reversals Table
CREATE TABLE IF NOT EXISTS transfer_reversals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  route_transfer_id uuid NOT NULL REFERENCES route_transfers(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  reason text,
  status text NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'PROCESSING', 'PROCESSED', 'FAILED')),
  provider_reversal_id text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX idx_transfer_reversals_booking ON transfer_reversals(booking_id);
CREATE INDEX idx_transfer_reversals_status ON transfer_reversals(status);

ALTER TABLE transfer_reversals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own transfer reversals" ON transfer_reversals
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM route_transfers t
      WHERE t.id = transfer_reversals.route_transfer_id AND t.owner_id = auth.uid()
    )
  );


-- 4. Get Refund Eligibility
CREATE OR REPLACE FUNCTION get_refund_eligibility(p_booking_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_booking record;
  v_payment record;
  v_already_refunded numeric;
  v_remaining_refundable numeric;
BEGIN
  -- Authenticate
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  IF v_booking IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Booking not found');
  END IF;

  -- Only renter or admin can request refund (simplified to renter here)
  IF v_booking.renter_id != auth.uid() THEN
    IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
      RETURN jsonb_build_object('eligible', false, 'reason', 'Unauthorized to request refund for this booking');
    END IF;
  END IF;

  SELECT * INTO v_payment FROM payments WHERE booking_id = p_booking_id AND status = 'PAID' ORDER BY created_at DESC LIMIT 1;
  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'No completed payment found');
  END IF;

  -- Calculate already refunded amount
  SELECT COALESCE(SUM(amount), 0) INTO v_already_refunded FROM refund_requests WHERE payment_id = v_payment.id AND status IN ('REQUESTED', 'PROCESSING', 'PROCESSED');
  
  v_remaining_refundable := v_payment.amount - v_already_refunded;

  IF v_remaining_refundable <= 0 THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Payment already fully refunded');
  END IF;

  -- Business policy check: If booking is COMPLETED or ACCEPTED, we can refund up to remaining amount.
  -- For cancellations, we permit refunds if policy allows.
  IF v_booking.status IN ('CANCELLED', 'DECLINED', 'ACCEPTED', 'COMPLETED') THEN
    RETURN jsonb_build_object(
      'eligible', true, 
      'maximum_refundable_amount', v_remaining_refundable,
      'payment_id', v_payment.id,
      'provider_payment_id', v_payment.provider_payment_id
    );
  END IF;

  RETURN jsonb_build_object('eligible', false, 'reason', 'Booking status does not permit refund');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 5. Get Transfer Reversal Eligibility
CREATE OR REPLACE FUNCTION get_transfer_reversal_eligibility(p_booking_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_transfer record;
  v_already_reversed numeric;
  v_remaining_reversible numeric;
BEGIN
  -- Authenticate
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_transfer FROM route_transfers WHERE booking_id = p_booking_id;
  IF v_transfer IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'No transfer found');
  END IF;

  -- Only admin (service_role) or automated flows can request reversal currently
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Unauthorized to reverse transfer');
  END IF;

  IF v_transfer.status NOT IN ('PROCESSED', 'CREATED') THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Transfer is not in a reversible state');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_already_reversed FROM transfer_reversals WHERE route_transfer_id = v_transfer.id AND status IN ('REQUESTED', 'PROCESSING', 'PROCESSED');
  
  v_remaining_reversible := v_transfer.owner_amount - v_already_reversed;

  IF v_remaining_reversible <= 0 THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Transfer already fully reversed');
  END IF;

  RETURN jsonb_build_object(
    'eligible', true,
    'maximum_reversible_amount', v_remaining_reversible,
    'route_transfer_id', v_transfer.id,
    'provider_transfer_id', v_transfer.provider_transfer_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
