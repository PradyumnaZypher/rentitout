-- 20261006000001_phase1_review_security.sql

-- Drop the old overly-permissive policy
DROP POLICY IF EXISTS "Renters can write reviews" ON reviews;

-- Create the strengthened policy ensuring that the user actually had a completed booking
CREATE POLICY "Renters can write reviews" ON reviews
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = author_id AND
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND b.renter_id = auth.uid()
        AND b.listing_id = reviews.listing_id
        AND b.status = 'COMPLETED'
    )
  );
