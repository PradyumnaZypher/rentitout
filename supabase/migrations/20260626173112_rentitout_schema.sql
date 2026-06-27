/*
# RentItOut - Full Schema

## Overview
This migration creates the complete schema for RentItOut, a peer-to-peer equipment rental marketplace.
Users can list items for rent and book items from other users.

## Tables
- profiles (extends auth.users)
- listings (items for rent)
- bookings (rental requests)
- reviews (post-rental ratings)
- messages (direct messaging)
- blocked_dates (unavailable dates per listing)
- wishlists (saved items)

## Security
- RLS enabled on all tables
- Owner-scoped policies for authenticated users
- Public read for listings/profiles
- Participant-scoped for bookings/messages
*/

-- PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  avatar_url text,
  phone text,
  city text NOT NULL DEFAULT '',
  bio text,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, city, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', ''),
    COALESCE(new.raw_user_meta_data->>'city', ''),
    COALESCE(new.raw_user_meta_data->>'avatar_url', null)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- LISTINGS TABLE
CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Others',
  condition text NOT NULL DEFAULT 'Good',
  price_per_day numeric(10,2) NOT NULL DEFAULT 0,
  min_days integer NOT NULL DEFAULT 1,
  max_days integer NOT NULL DEFAULT 30,
  deposit numeric(10,2),
  rules text,
  city text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT '',
  images text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listings_owner_id_idx ON listings(owner_id);
CREATE INDEX IF NOT EXISTS listings_category_idx ON listings(category);
CREATE INDEX IF NOT EXISTS listings_city_idx ON listings(city);
CREATE INDEX IF NOT EXISTS listings_is_active_idx ON listings(is_active);
CREATE INDEX IF NOT EXISTS listings_created_at_idx ON listings(created_at DESC);

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active listings are viewable by everyone" ON listings;
CREATE POLICY "Active listings are viewable by everyone" ON listings
  FOR SELECT TO anon, authenticated USING (is_active = true OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own listings" ON listings;
CREATE POLICY "Users can insert own listings" ON listings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update own listings" ON listings;
CREATE POLICY "Owners can update own listings" ON listings
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete own listings" ON listings;
CREATE POLICY "Owners can delete own listings" ON listings
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_days integer NOT NULL,
  total_price numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  message text,
  renter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_renter_id_idx ON bookings(renter_id);
CREATE INDEX IF NOT EXISTS bookings_listing_id_idx ON bookings(listing_id);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Bookings viewable by renter and listing owner" ON bookings;
CREATE POLICY "Bookings viewable by renter and listing owner" ON bookings
  FOR SELECT TO authenticated USING (
    auth.uid() = renter_id OR
    auth.uid() IN (SELECT owner_id FROM listings WHERE id = listing_id)
  );

DROP POLICY IF EXISTS "Renters can create bookings" ON bookings;
CREATE POLICY "Renters can create bookings" ON bookings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = renter_id);

DROP POLICY IF EXISTS "Booking participants can update status" ON bookings;
CREATE POLICY "Booking participants can update status" ON bookings
  FOR UPDATE TO authenticated USING (
    auth.uid() = renter_id OR
    auth.uid() IN (SELECT owner_id FROM listings WHERE id = listing_id)
  );

-- REVIEWS TABLE
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL DEFAULT '',
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_listing_id_idx ON reviews(listing_id);
CREATE INDEX IF NOT EXISTS reviews_author_id_idx ON reviews(author_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON reviews;
CREATE POLICY "Reviews are viewable by everyone" ON reviews
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Renters can write reviews" ON reviews;
CREATE POLICY "Renters can write reviews" ON reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

-- MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id text NOT NULL,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON messages(sender_id);
CREATE INDEX IF NOT EXISTS messages_receiver_id_idx ON messages(receiver_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Messages viewable by participants" ON messages;
CREATE POLICY "Messages viewable by participants" ON messages
  FOR SELECT TO authenticated USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Receivers can mark messages as read" ON messages;
CREATE POLICY "Receivers can mark messages as read" ON messages
  FOR UPDATE TO authenticated USING (auth.uid() = receiver_id);

-- BLOCKED DATES TABLE
CREATE TABLE IF NOT EXISTS blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS blocked_dates_listing_id_idx ON blocked_dates(listing_id);

ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Blocked dates viewable by everyone" ON blocked_dates;
CREATE POLICY "Blocked dates viewable by everyone" ON blocked_dates
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Owners can manage blocked dates" ON blocked_dates;
CREATE POLICY "Owners can manage blocked dates" ON blocked_dates
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() IN (SELECT owner_id FROM listings WHERE id = listing_id)
  );

DROP POLICY IF EXISTS "Owners can delete blocked dates" ON blocked_dates;
CREATE POLICY "Owners can delete blocked dates" ON blocked_dates
  FOR DELETE TO authenticated USING (
    auth.uid() IN (SELECT owner_id FROM listings WHERE id = listing_id)
  );

-- WISHLIST TABLE
CREATE TABLE IF NOT EXISTS wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wishlists" ON wishlists;
CREATE POLICY "Users can view own wishlists" ON wishlists
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add to wishlist" ON wishlists;
CREATE POLICY "Users can add to wishlist" ON wishlists
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove from wishlist" ON wishlists;
CREATE POLICY "Users can remove from wishlist" ON wishlists
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Profile for existing test user
INSERT INTO profiles (id, name, city, bio)
SELECT id, 'Demo User', 'Mumbai', 'Photography enthusiast & gadget lover'
FROM auth.users WHERE email = 'bolt-test-1782494547377@test.local'
ON CONFLICT (id) DO UPDATE SET name = 'Demo User', city = 'Mumbai';

-- Seed sample listings with actual test user id
INSERT INTO listings (id, title, description, category, condition, price_per_day, min_days, max_days, deposit, rules, city, area, images, owner_id)
SELECT 
  gen_random_uuid(),
  t.title,
  t.description,
  t.category,
  t.condition,
  t.price_per_day,
  t.min_days,
  t.max_days,
  t.deposit,
  t.rules,
  t.city,
  t.area,
  t.images,
  u.id
FROM (
  VALUES
    ('Canon EOS R5 Camera', 'Professional mirrorless camera with 45MP sensor. Perfect for events, portraits, and landscapes. Includes 24-70mm lens, 2 batteries, and memory card.', 'Cameras', 'Excellent', 1200, 1, 7, 5000, 'No commercial shoots without prior approval. Return in same condition.', 'Mumbai', 'Bandra', ARRAY['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800', 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800']),
    ('Bosch Power Drill Set', 'Heavy-duty cordless drill with full accessory kit. 18V, includes 2 batteries, charger, and 50-piece bit set.', 'Tools', 'Good', 250, 1, 14, 1000, 'Please return clean. All accessories must be returned.', 'Delhi', 'Saket', ARRAY['https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800']),
    ('DJI Mavic Air 2 Drone', 'Foldable drone with 4K camera. 34-min flight time, 10km range, includes 3 batteries, landing pad, and carry case.', 'Cameras', 'Excellent', 1800, 2, 5, 8000, 'Must have valid drone license. No flying over restricted areas.', 'Bangalore', 'Koramangala', ARRAY['https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=800', 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=800']),
    ('Sony A7 III + 85mm Lens', 'Full-frame mirrorless with stunning portrait bokeh. Includes 85mm f/1.8 prime lens and peak design strap.', 'Cameras', 'Excellent', 950, 1, 10, 4000, 'Handle with care. UV filter must stay on lens.', 'Mumbai', 'Andheri', ARRAY['https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800']),
    ('Fender Acoustic Guitar', 'Beautiful Fender CD-60S acoustic guitar with bag, capo, picks, and tuner. Great for campfires and performances.', 'Music', 'Good', 300, 3, 30, 2000, 'No modifications. Keep away from extreme temperatures.', 'Delhi', 'Lajpat Nagar', ARRAY['https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800']),
    ('Projector 4K Ultra HD', 'BenQ 4K projector with 3000 lumens. Perfect for movie nights, presentations, or events. Includes HDMI cables and remote.', 'Electronics', 'Excellent', 800, 1, 7, 3000, 'Return with all accessories. No outdoor use.', 'Bangalore', 'Whitefield', ARRAY['https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800']),
    ('Trek Mountain Bike', 'Trek Marlin 7 full suspension MTB. 27.5" wheels, hydraulic disc brakes. Includes helmet and lock.', 'Sports', 'Good', 500, 2, 14, 3000, 'Wear provided helmet. No stunts or racing.', 'Mumbai', 'Powai', ARRAY['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800']),
    ('Camping Tent (4-Person)', 'Coleman Sundome 4-person tent. Waterproof, easy setup in 15 minutes. Includes stakes, rainfly, and carry bag.', 'Outdoor', 'Good', 400, 2, 21, 1500, 'Clean before returning. No campfire near the tent.', 'Bangalore', 'HSR Layout', ARRAY['https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800']),
    ('GoPro Hero 11 Action Camera', 'Waterproof action camera with 5.3K video. Includes chest mount, head mount, wrist strap, and 3 batteries.', 'Cameras', 'Excellent', 600, 1, 14, 2500, 'Return all mounts. Waterproof housing must be returned intact.', 'Delhi', 'Dwarka', ARRAY['https://images.unsplash.com/photo-1601004890657-91f4e3e1c559?w=800']),
    ('Electric Pressure Washer', 'Karcher K5 pressure washer with 145 bar. Ideal for cars, driveways, and patios. Includes 3 nozzles.', 'Tools', 'Good', 350, 1, 7, 1500, 'Return clean. Do not use on painted surfaces at full pressure.', 'Mumbai', 'Thane', ARRAY['https://images.unsplash.com/photo-1558618047-3c8d69fa1679?w=800'])
) AS t(title, description, category, condition, price_per_day, min_days, max_days, deposit, rules, city, area, images),
(SELECT id FROM auth.users WHERE email = 'bolt-test-1782494547377@test.local' LIMIT 1) AS u(id)
ON CONFLICT DO NOTHING;
