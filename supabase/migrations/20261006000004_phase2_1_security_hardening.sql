-- 20261006000004_phase2_1_security_hardening.sql

-- 1. Hardened Booking Updates Guard
CREATE OR REPLACE FUNCTION guard_booking_updates()
RETURNS trigger AS $$
DECLARE
  is_renter boolean;
  is_owner boolean;
BEGIN
  -- Prevent tampering with protected fields (NULL-safe)
  IF NEW.renter_id IS DISTINCT FROM OLD.renter_id THEN
    RAISE EXCEPTION 'Cannot change renter_id';
  END IF;
  IF NEW.listing_id IS DISTINCT FROM OLD.listing_id THEN
    RAISE EXCEPTION 'Cannot change listing_id';
  END IF;
  IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN
    RAISE EXCEPTION 'Cannot change start_date after creation';
  END IF;
  IF NEW.end_date IS DISTINCT FROM OLD.end_date THEN
    RAISE EXCEPTION 'Cannot change end_date after creation';
  END IF;
  IF NEW.total_days IS DISTINCT FROM OLD.total_days THEN
    RAISE EXCEPTION 'Cannot change total_days after creation';
  END IF;
  IF NEW.total_price IS DISTINCT FROM OLD.total_price THEN
    RAISE EXCEPTION 'Cannot change total_price after creation';
  END IF;
  
  -- Enforce status transitions
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    
    is_renter := (auth.uid() = OLD.renter_id);
    is_owner := EXISTS (SELECT 1 FROM listings WHERE id = OLD.listing_id AND owner_id = auth.uid());

    -- Explicitly reject unauthorized actors
    IF NOT is_renter AND NOT is_owner THEN
      RAISE EXCEPTION 'Unauthorized to change booking status';
    END IF;
    
    -- Evaluate transitions based on role deterministically
    IF is_renter THEN
      IF NEW.status != 'CANCELLED' THEN
        RAISE EXCEPTION 'Renters can only cancel bookings';
      END IF;
      IF OLD.status NOT IN ('PENDING', 'ACCEPTED') THEN
        RAISE EXCEPTION 'Cannot cancel a booking in % state', OLD.status;
      END IF;
    ELSIF is_owner THEN
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

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 2. Hardened Message Updates Guard
CREATE OR REPLACE FUNCTION guard_message_updates()
RETURNS trigger AS $$
BEGIN
  -- Explicitly verify that NO field except "read" is changed
  IF NEW.id IS DISTINCT FROM OLD.id OR
     NEW.content IS DISTINCT FROM OLD.content OR
     NEW.sender_id IS DISTINCT FROM OLD.sender_id OR
     NEW.receiver_id IS DISTINCT FROM OLD.receiver_id OR
     NEW.conversation_id IS DISTINCT FROM OLD.conversation_id OR
     NEW.listing_id IS DISTINCT FROM OLD.listing_id OR
     NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Only the read status can be modified';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
