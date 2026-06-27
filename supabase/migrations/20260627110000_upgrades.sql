-- 1. Add coordinates to listings for distance sorting (Haversine)
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS lat double precision,
ADD COLUMN IF NOT EXISTS lng double precision;

-- 2. Add Full-Text Search (FTS) column and index
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS fts tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(city, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(area, '')), 'D')
) STORED;

CREATE INDEX IF NOT EXISTS listings_fts_idx ON listings USING GIN (fts);

-- 3. Create a Haversine Distance function
CREATE OR REPLACE FUNCTION calculate_distance(lat1 float, lon1 float, lat2 float, lon2 float)
RETURNS float AS $$
DECLARE
    x float = 69.1 * (lat2 - lat1);
    y float = 69.1 * (lon2 - lon1) * cos(lat1 / 57.3);
BEGIN
    RETURN sqrt(x * x + y * y);
END
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Create an RPC to search listings and optionally sort by distance
CREATE OR REPLACE FUNCTION search_listings_advanced(
  search_query text,
  user_lat float,
  user_lng float,
  categories text[],
  conditions text[],
  min_price numeric,
  max_price numeric,
  city_filter text,
  sort_by text
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  category text,
  condition text,
  price_per_day numeric,
  min_days integer,
  max_days integer,
  deposit numeric,
  rules text,
  city text,
  area text,
  images text[],
  is_active boolean,
  owner_id uuid,
  view_count integer,
  created_at timestamptz,
  updated_at timestamptz,
  lat double precision,
  lng double precision,
  distance float,
  owner_name text,
  owner_avatar text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id, l.title, l.description, l.category, l.condition, l.price_per_day, l.min_days, l.max_days, l.deposit, l.rules, l.city, l.area, l.images, l.is_active, l.owner_id, l.view_count, l.created_at, l.updated_at, l.lat, l.lng,
    CASE 
      WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL AND l.lat IS NOT NULL AND l.lng IS NOT NULL 
      THEN calculate_distance(user_lat, user_lng, l.lat, l.lng)
      ELSE NULL
    END as distance,
    p.name as owner_name,
    p.avatar_url as owner_avatar
  FROM listings l
  JOIN profiles p ON p.id = l.owner_id
  WHERE l.is_active = true
    AND (search_query IS NULL OR search_query = '' OR l.fts @@ plainto_tsquery('english', search_query))
    AND (categories IS NULL OR array_length(categories, 1) IS NULL OR l.category = ANY(categories))
    AND (conditions IS NULL OR array_length(conditions, 1) IS NULL OR l.condition = ANY(conditions))
    AND (min_price IS NULL OR l.price_per_day >= min_price)
    AND (max_price IS NULL OR l.price_per_day <= max_price)
    AND (city_filter IS NULL OR city_filter = '' OR l.city ILIKE '%' || city_filter || '%')
  ORDER BY 
    CASE WHEN sort_by = 'distance' AND user_lat IS NOT NULL THEN calculate_distance(user_lat, user_lng, l.lat, l.lng) END ASC NULLS LAST,
    CASE WHEN sort_by = 'price_asc' THEN l.price_per_day END ASC NULLS LAST,
    CASE WHEN sort_by = 'price_desc' THEN l.price_per_day END DESC NULLS LAST,
    CASE WHEN sort_by = 'newest' THEN l.created_at END DESC NULLS LAST,
    l.created_at DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- 5. Tighten RLS on Messages to strictly check conversation_id components
DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = sender_id AND 
    conversation_id = LEAST(sender_id::text, receiver_id::text) || '_' || GREATEST(sender_id::text, receiver_id::text)
  );
