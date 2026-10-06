-- Phase 7: Notifications & Communication Reliability

-- 1. Create Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  entity_type text,
  entity_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Index for efficient querying by user
CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_id_is_read_idx ON notifications(user_id, is_read) WHERE is_read = false;

-- 2. Notification RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Immutability Trigger
CREATE OR REPLACE FUNCTION restrict_notification_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.id != OLD.id OR
     NEW.user_id != OLD.user_id OR
     NEW.type != OLD.type OR
     NEW.title != OLD.title OR
     NEW.message != OLD.message OR
     NEW.entity_type IS DISTINCT FROM OLD.entity_type OR
     NEW.entity_id IS DISTINCT FROM OLD.entity_id OR
     NEW.created_at != OLD.created_at
  THEN
    RAISE EXCEPTION 'Only the is_read status can be modified';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS notification_update_trigger ON notifications;
CREATE TRIGGER notification_update_trigger
BEFORE UPDATE ON notifications
FOR EACH ROW EXECUTE PROCEDURE restrict_notification_update();

-- 4. Notification Generator Function
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_entity_type text,
  p_entity_id uuid
)
RETURNS void AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
  VALUES (p_user_id, p_type, p_title, p_message, p_entity_type, p_entity_id);
EXCEPTION WHEN OTHERS THEN
  -- Fail silently so we don't rollback the primary transaction if notification fails
  RAISE WARNING 'Notification creation failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 5. Booking Notification Triggers
CREATE OR REPLACE FUNCTION handle_booking_notifications()
RETURNS trigger AS $$
DECLARE
  listing_owner uuid;
  listing_title text;
  renter_name text;
BEGIN
  -- Get listing info
  SELECT owner_id, title INTO listing_owner, listing_title FROM listings WHERE id = COALESCE(NEW.listing_id, OLD.listing_id);
  
  IF TG_OP = 'INSERT' THEN
    -- Get renter name
    SELECT name INTO renter_name FROM public_profiles WHERE id = NEW.renter_id;
    -- Renter creates booking -> notify owner
    PERFORM create_notification(
      listing_owner, 
      'BOOKING_CREATED', 
      'New booking request', 
      renter_name || ' requested your listing: ' || listing_title, 
      'booking', 
      NEW.id
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status != OLD.status THEN
      IF NEW.status = 'ACCEPTED' THEN
        -- Owner accepted -> notify renter
        PERFORM create_notification(NEW.renter_id, 'BOOKING_ACCEPTED', 'Booking Accepted', 'Your request for ' || listing_title || ' was accepted', 'booking', NEW.id);
      ELSIF NEW.status = 'DECLINED' THEN
        -- Owner declined -> notify renter
        PERFORM create_notification(NEW.renter_id, 'BOOKING_DECLINED', 'Booking Declined', 'Your request for ' || listing_title || ' was declined', 'booking', NEW.id);
      ELSIF NEW.status = 'COMPLETED' THEN
        -- Owner completed -> notify renter
        PERFORM create_notification(NEW.renter_id, 'BOOKING_COMPLETED', 'Rental Completed', 'Your rental for ' || listing_title || ' has been marked completed', 'booking', NEW.id);
      ELSIF NEW.status = 'CANCELLED' THEN
        -- Renter or Owner cancelled -> notify the other
        IF auth.uid() = NEW.renter_id THEN
          -- Renter cancelled -> notify owner
          SELECT name INTO renter_name FROM public_profiles WHERE id = NEW.renter_id;
          PERFORM create_notification(listing_owner, 'BOOKING_CANCELLED', 'Booking Cancelled', renter_name || ' cancelled the booking for ' || listing_title, 'booking', NEW.id);
        ELSE
          -- Owner cancelled -> notify renter
          PERFORM create_notification(NEW.renter_id, 'BOOKING_CANCELLED', 'Booking Cancelled', 'The owner cancelled the booking for ' || listing_title, 'booking', NEW.id);
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_booking_notifications ON bookings;
CREATE TRIGGER trigger_booking_notifications
AFTER INSERT OR UPDATE ON bookings
FOR EACH ROW EXECUTE PROCEDURE handle_booking_notifications();


-- 6. Message Notification Triggers
CREATE OR REPLACE FUNCTION handle_message_notifications()
RETURNS trigger AS $$
DECLARE
  sender_name text;
BEGIN
  -- Notify receiver if they are not the one sending the message
  IF NEW.sender_id != NEW.receiver_id THEN
    SELECT name INTO sender_name FROM public_profiles WHERE id = NEW.sender_id;
    PERFORM create_notification(
      NEW.receiver_id, 
      'NEW_MESSAGE', 
      'New Message', 
      'You have a new message from ' || sender_name, 
      'message', 
      NEW.conversation_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_message_notifications ON messages;
CREATE TRIGGER trigger_message_notifications
AFTER INSERT ON messages
FOR EACH ROW EXECUTE PROCEDURE handle_message_notifications();


-- 7. Review Notification Triggers
CREATE OR REPLACE FUNCTION handle_review_notifications()
RETURNS trigger AS $$
DECLARE
  listing_owner uuid;
  listing_title text;
BEGIN
  -- Get listing owner
  SELECT owner_id, title INTO listing_owner, listing_title FROM listings WHERE id = NEW.listing_id;
  
  -- Notify owner
  IF listing_owner != NEW.author_id THEN
    PERFORM create_notification(
      listing_owner, 
      'REVIEW_RECEIVED', 
      'New Review Received', 
      'You received a new review for ' || listing_title, 
      'review', 
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_review_notifications ON reviews;
CREATE TRIGGER trigger_review_notifications
AFTER INSERT ON reviews
FOR EACH ROW EXECUTE PROCEDURE handle_review_notifications();

-- 8. Moderation Notification Integration
CREATE OR REPLACE FUNCTION admin_moderate_user(target_user_id uuid, new_status text, admin_reason text)
RETURNS boolean AS $$
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE profiles SET status = new_status WHERE id = target_user_id;
  
  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, reason)
  VALUES (auth.uid(), 'MODERATE_USER_' || new_status, 'profiles', target_user_id::text, admin_reason);
  
  PERFORM create_notification(target_user_id, 'ACCOUNT_MODERATED', 'Account Status Changed', 'Your account has been ' || new_status, 'profile', target_user_id);
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION admin_moderate_listing(target_listing_id uuid, new_status text, admin_reason text)
RETURNS boolean AS $$
DECLARE
  listing_owner uuid;
  listing_title text;
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE listings SET moderation_status = new_status WHERE id = target_listing_id RETURNING owner_id, title INTO listing_owner, listing_title;
  
  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, reason)
  VALUES (auth.uid(), 'MODERATE_LISTING_' || new_status, 'listings', target_listing_id::text, admin_reason);

  PERFORM create_notification(listing_owner, 'LISTING_MODERATED', 'Listing Status Changed', 'Your listing ' || listing_title || ' has been ' || new_status, 'listing', target_listing_id);
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

