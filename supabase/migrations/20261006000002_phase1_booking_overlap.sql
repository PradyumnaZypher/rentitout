-- 20261006000002_phase1_booking_overlap.sql

CREATE OR REPLACE FUNCTION check_booking_overlap()
RETURNS trigger AS $$
DECLARE
  listing_price numeric;
  expected_days integer;
  expected_price numeric;
BEGIN
  -- Lock the listing to prevent concurrent booking race conditions
  PERFORM 1 FROM listings WHERE id = NEW.listing_id FOR NO KEY UPDATE;
  
  -- Calculate and enforce days and price
  SELECT price_per_day INTO listing_price FROM listings WHERE id = NEW.listing_id;
  
  expected_days := GREATEST(1, NEW.end_date - NEW.start_date);
  expected_price := expected_days * listing_price;
  
  -- Force the values to be correct, ignoring client input if it was wrong
  NEW.total_days := expected_days;
  NEW.total_price := expected_price;

  -- Check for overlaps
  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE listing_id = NEW.listing_id
      AND id != NEW.id -- ignore self on update
      AND status IN ('PENDING', 'ACCEPTED')
      AND NEW.start_date <= end_date
      AND NEW.end_date >= start_date
  ) THEN
    RAISE EXCEPTION 'Booking dates overlap with an existing active booking.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS booking_overlap_trigger ON bookings;
CREATE TRIGGER booking_overlap_trigger
BEFORE INSERT OR UPDATE ON bookings
FOR EACH ROW EXECUTE PROCEDURE check_booking_overlap();
