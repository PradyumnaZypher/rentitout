-- Phase 6: Admin Foundation and Moderation

-- 1. Admin Authorization Table
CREATE TABLE IF NOT EXISTS admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 2. Secure RPC for Admin Verification
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE POLICY "Admins can view admin_users" ON admin_users
  FOR SELECT TO authenticated 
  USING (is_current_user_admin());

-- 3. Audit Log
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit log" ON admin_audit_log
  FOR SELECT TO authenticated 
  USING (is_current_user_admin());

-- 4. User Moderation Status
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE';

-- Protect profile status updates
CREATE OR REPLACE FUNCTION guard_profile_status()
RETURNS trigger AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    IF NOT is_current_user_admin() THEN
      RAISE EXCEPTION 'Only administrators can change profile status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS guard_profile_status_trigger ON profiles;
CREATE TRIGGER guard_profile_status_trigger
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE PROCEDURE guard_profile_status();

-- Enforce ban/suspension centrally across insertions
CREATE OR REPLACE FUNCTION block_banned_users()
RETURNS trigger AS $$
DECLARE
  user_status text;
BEGIN
  SELECT status INTO user_status FROM profiles WHERE id = auth.uid();
  IF user_status IN ('BANNED', 'SUSPENDED') THEN
    RAISE EXCEPTION 'Your account has been %.', user_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS block_banned_users_listings ON listings;
CREATE TRIGGER block_banned_users_listings BEFORE INSERT ON listings FOR EACH ROW EXECUTE PROCEDURE block_banned_users();

DROP TRIGGER IF EXISTS block_banned_users_bookings ON bookings;
CREATE TRIGGER block_banned_users_bookings BEFORE INSERT ON bookings FOR EACH ROW EXECUTE PROCEDURE block_banned_users();

DROP TRIGGER IF EXISTS block_banned_users_reviews ON reviews;
CREATE TRIGGER block_banned_users_reviews BEFORE INSERT ON reviews FOR EACH ROW EXECUTE PROCEDURE block_banned_users();

DROP TRIGGER IF EXISTS block_banned_users_messages ON messages;
CREATE TRIGGER block_banned_users_messages BEFORE INSERT ON messages FOR EACH ROW EXECUTE PROCEDURE block_banned_users();


-- 5. Listing Moderation
ALTER TABLE listings ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'APPROVED';

CREATE OR REPLACE FUNCTION guard_listing_moderation()
RETURNS trigger AS $$
BEGIN
  IF NEW.moderation_status != OLD.moderation_status THEN
    IF NOT is_current_user_admin() THEN
      RAISE EXCEPTION 'Only administrators can change moderation_status';
    END IF;
  END IF;
  
  -- If admin rejects/suspends listing, force is_active false
  IF NEW.moderation_status != 'APPROVED' THEN
    NEW.is_active = false;
  END IF;
  
  -- If a normal user tries to reactivate a suspended listing, block it
  IF NEW.is_active = true AND NEW.moderation_status != 'APPROVED' THEN
    RAISE EXCEPTION 'Cannot activate a moderated listing';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS guard_listing_moderation_trigger ON listings;
CREATE TRIGGER guard_listing_moderation_trigger
BEFORE UPDATE ON listings
FOR EACH ROW EXECUTE PROCEDURE guard_listing_moderation();


-- 6. Review Moderation
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION guard_review_visibility()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_visible != OLD.is_visible THEN
    IF NOT is_current_user_admin() THEN
      RAISE EXCEPTION 'Only administrators can change review visibility';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS guard_review_visibility_trigger ON reviews;
CREATE TRIGGER guard_review_visibility_trigger
BEFORE UPDATE ON reviews
FOR EACH ROW EXECUTE PROCEDURE guard_review_visibility();

-- 7. Update get_user_rating_summary to only aggregate visible reviews
CREATE OR REPLACE FUNCTION get_user_rating_summary(target_user_id uuid)
RETURNS TABLE (
  avg_rating numeric,
  review_count bigint,
  five_star bigint,
  four_star bigint,
  three_star bigint,
  two_star bigint,
  one_star bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(AVG(r.rating), 0)::numeric as avg_rating,
    COUNT(r.id) as review_count,
    COUNT(r.id) FILTER (WHERE r.rating = 5) as five_star,
    COUNT(r.id) FILTER (WHERE r.rating = 4) as four_star,
    COUNT(r.id) FILTER (WHERE r.rating = 3) as three_star,
    COUNT(r.id) FILTER (WHERE r.rating = 2) as two_star,
    COUNT(r.id) FILTER (WHERE r.rating = 1) as one_star
  FROM reviews r
  JOIN listings l ON l.id = r.listing_id
  WHERE l.owner_id = target_user_id AND r.is_visible = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. Admin Action RPCs (Atomic state + audit log)
CREATE OR REPLACE FUNCTION admin_moderate_user(target_user_id uuid, new_status text, admin_reason text)
RETURNS boolean AS $$
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE profiles SET status = new_status WHERE id = target_user_id;
  
  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, reason)
  VALUES (auth.uid(), 'MODERATE_USER_' || new_status, 'profiles', target_user_id::text, admin_reason);
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION admin_moderate_listing(target_listing_id uuid, new_status text, admin_reason text)
RETURNS boolean AS $$
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE listings SET moderation_status = new_status WHERE id = target_listing_id;
  
  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, reason)
  VALUES (auth.uid(), 'MODERATE_LISTING_' || new_status, 'listings', target_listing_id::text, admin_reason);
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION admin_moderate_review(target_review_id uuid, visibility boolean, admin_reason text)
RETURNS boolean AS $$
DECLARE
  action_text text;
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE reviews SET is_visible = visibility WHERE id = target_review_id;
  
  IF visibility THEN
    action_text := 'RESTORE_REVIEW';
  ELSE
    action_text := 'HIDE_REVIEW';
  END IF;

  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, reason)
  VALUES (auth.uid(), action_text, 'reviews', target_review_id::text, admin_reason);
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 9. Expose status in public_profiles
CREATE OR REPLACE VIEW public_profiles AS
SELECT id, name, avatar_url, city, bio, is_verified, status, created_at
FROM profiles;

