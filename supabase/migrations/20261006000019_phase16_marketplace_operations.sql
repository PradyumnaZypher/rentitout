-- Phase 16: Marketplace Operations & Trust

-- 1. Favorites
CREATE TABLE IF NOT EXISTS favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS favorites_user_id_created_at_idx ON favorites(user_id, created_at);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites" ON favorites
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites" ON favorites
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites" ON favorites
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. Reports (User Reporting System)
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('LISTING', 'USER', 'REVIEW', 'MESSAGE')),
  target_id text NOT NULL,
  reason text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED')),
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  resolution_note text
);

CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status);
CREATE INDEX IF NOT EXISTS reports_target_type_id_idx ON reports(target_type, target_id);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert reports" ON reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports" ON reports
  FOR SELECT TO authenticated USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all reports" ON reports
  FOR SELECT TO authenticated USING (is_current_user_admin());

CREATE POLICY "Admins can update reports" ON reports
  FOR UPDATE TO authenticated USING (is_current_user_admin());

-- 3. Booking Disputes
CREATE TABLE IF NOT EXISTS booking_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  opened_by uuid NOT NULL REFERENCES auth.users(id),
  reason text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED')),
  admin_notes text,
  resolved_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS booking_disputes_booking_id_idx ON booking_disputes(booking_id);
CREATE INDEX IF NOT EXISTS booking_disputes_status_idx ON booking_disputes(status);

ALTER TABLE booking_disputes ENABLE ROW LEVEL SECURITY;

-- Security Definer helper to check if user is part of booking
CREATE OR REPLACE FUNCTION is_booking_participant(b_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM bookings b
    JOIN listings l ON b.listing_id = l.id
    WHERE b.id = b_id AND (b.renter_id = auth.uid() OR l.owner_id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE POLICY "Participants can view their disputes" ON booking_disputes
  FOR SELECT TO authenticated USING (is_booking_participant(booking_id) OR is_current_user_admin());

CREATE POLICY "Participants can insert disputes" ON booking_disputes
  FOR INSERT TO authenticated WITH CHECK (is_booking_participant(booking_id));

CREATE POLICY "Admins can update disputes" ON booking_disputes
  FOR UPDATE TO authenticated USING (is_current_user_admin());

-- 4. Guard updates on reports/disputes (Admins only for status changes)
CREATE OR REPLACE FUNCTION guard_report_status()
RETURNS trigger AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    IF NOT is_current_user_admin() THEN
      RAISE EXCEPTION 'Only administrators can change report status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER guard_report_status_trigger
BEFORE UPDATE ON reports
FOR EACH ROW EXECUTE PROCEDURE guard_report_status();

CREATE TRIGGER guard_dispute_status_trigger
BEFORE UPDATE ON booking_disputes
FOR EACH ROW EXECUTE PROCEDURE guard_report_status();
