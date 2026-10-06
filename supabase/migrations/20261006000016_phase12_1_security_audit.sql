-- Phase 12.1 Security Audit Fixes

-- 1. Expand settlement_status in route_transfers
ALTER TABLE route_transfers DROP CONSTRAINT route_transfers_settlement_status_check;
ALTER TABLE route_transfers ADD CONSTRAINT route_transfers_settlement_status_check
  CHECK (settlement_status IN ('PENDING', 'ON_HOLD', 'RELEASE_REQUESTED', 'SETTLED'));

-- 2. Expand event_type in financial_ledger
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
      'SETTLEMENT_RELEASE_REQUESTED',
      'SETTLEMENT_RELEASED',
      'OWNER_SETTLED'
  ));

-- 3. Add RPC to handle settlement.processed webhook
CREATE OR REPLACE FUNCTION update_transfers_settled_for_account(
  p_provider_account_id text,
  p_provider_settlement_id text
)
RETURNS boolean AS $$
DECLARE
  v_transfer record;
BEGIN
  -- Service role only
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  FOR v_transfer IN
    SELECT * FROM route_transfers
    WHERE provider_account_id = p_provider_account_id
      AND settlement_status = 'RELEASE_REQUESTED'
  LOOP
    -- Update transfer status
    UPDATE route_transfers
    SET settlement_status = 'SETTLED',
        updated_at = now()
    WHERE id = v_transfer.id;

    -- Append ledger event
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
      'OWNER_SETTLED',
      v_transfer.owner_amount,
      v_transfer.currency,
      'Provider settlement processed ' || p_provider_settlement_id
    );
  END LOOP;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
