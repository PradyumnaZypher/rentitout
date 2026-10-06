-- 20261006000003_phase2_authorization.sql

-- 1. Guard Booking Updates
CREATE OR REPLACE FUNCTION guard_booking_updates()
RETURNS trigger AS $$
BEGIN
  -- Prevent tampering with protected fields
  IF NEW.renter_id != OLD.renter_id THEN
    RAISE EXCEPTION 'Cannot change renter_id';
  END IF;
  IF NEW.listing_id != OLD.listing_id THEN
    RAISE EXCEPTION 'Cannot change listing_id';
  END IF;
  IF NEW.start_date != OLD.start_date THEN
    RAISE EXCEPTION 'Cannot change start_date after creation';
  END IF;
  IF NEW.end_date != OLD.end_date THEN
    RAISE EXCEPTION 'Cannot change end_date after creation';
  END IF;
  IF NEW.total_days != OLD.total_days THEN
    RAISE EXCEPTION 'Cannot change total_days after creation';
  END IF;
  IF NEW.total_price != OLD.total_price THEN
    RAISE EXCEPTION 'Cannot change total_price after creation';
  END IF;
  
  -- Enforce status transitions
  IF NEW.status != OLD.status THEN
    
    -- Renters can only transition to CANCELLED, and only if PENDING or ACCEPTED
    IF auth.uid() = OLD.renter_id THEN
      IF NEW.status != 'CANCELLED' THEN
        RAISE EXCEPTION 'Renters can only cancel bookings';
      END IF;
      IF OLD.status NOT IN ('PENDING', 'ACCEPTED') THEN
        RAISE EXCEPTION 'Cannot cancel a booking in % state', OLD.status;
      END IF;
    END IF;

    -- Owners can transition PENDING -> ACCEPTED | DECLINED, and ACCEPTED -> COMPLETED | CANCELLED
    IF auth.uid() IN (SELECT owner_id FROM listings WHERE id = OLD.listing_id) THEN
      IF OLD.status = 'PENDING' AND NEW.status NOT IN ('ACCEPTED', 'DECLINED') THEN
         RAISE EXCEPTION 'Invalid transition from PENDING';
      END IF;
      IF OLD.status = 'ACCEPTED' AND NEW.status NOT IN ('COMPLETED', 'CANCELLED') THEN
         RAISE EXCEPTION 'Invalid transition from ACCEPTED';
      END IF;
      IF OLD.status IN ('DECLINED', 'COMPLETED', 'CANCELLED') THEN
         RAISE EXCEPTION 'Cannot change status of a finished booking';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS booking_lifecycle_guard_trigger ON bookings;
CREATE TRIGGER booking_lifecycle_guard_trigger
BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE PROCEDURE guard_booking_updates();

-- 2. Guard Message Updates
CREATE OR REPLACE FUNCTION guard_message_updates()
RETURNS trigger AS $$
BEGIN
  IF NEW.id != OLD.id THEN
    RAISE EXCEPTION 'Cannot change message id';
  END IF;
  IF NEW.content != OLD.content THEN
    RAISE EXCEPTION 'Cannot change message content';
  END IF;
  IF NEW.sender_id != OLD.sender_id THEN
    RAISE EXCEPTION 'Cannot change message sender';
  END IF;
  IF NEW.receiver_id != OLD.receiver_id THEN
    RAISE EXCEPTION 'Cannot change message receiver';
  END IF;
  IF NEW.conversation_id != OLD.conversation_id THEN
    RAISE EXCEPTION 'Cannot change message conversation';
  END IF;
  IF NEW.listing_id IS DISTINCT FROM OLD.listing_id THEN
    RAISE EXCEPTION 'Cannot change message listing';
  END IF;
  
  -- Only "read" status can be changed
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS message_tamper_guard_trigger ON messages;
CREATE TRIGGER message_tamper_guard_trigger
BEFORE UPDATE ON messages
FOR EACH ROW EXECUTE PROCEDURE guard_message_updates();
