-- Phase 5: Profiles and Reviews Security and Visibility

-- 1. Create a secure view for public profile information
CREATE OR REPLACE VIEW public_profiles AS
SELECT 
  id, 
  name, 
  avatar_url, 
  city, 
  bio, 
  is_verified, 
  created_at
FROM profiles;

-- Grant access to the view
GRANT SELECT ON public_profiles TO anon, authenticated;

-- 2. Restrict direct table access on profiles to preserve privacy (like phone numbers)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT TO authenticated 
  USING (auth.uid() = id);

-- 3. Update the search RPC to use public_profiles instead of profiles so it doesn't fail due to RLS
DROP FUNCTION IF EXISTS search_listings_advanced(text, double precision, double precision, text[], text[], numeric, numeric, text, text, integer, integer);

CREATE OR REPLACE FUNCTION search_listings_advanced(
  search_query text,
  user_lat float,
  user_lng float,
  categories text[],
  conditions text[],
  min_price numeric,
  max_price numeric,
  city_filter text,
  sort_by text,
  limit_count integer DEFAULT 20,
  offset_count integer DEFAULT 0
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
  owner_avatar text,
  total_count bigint
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
    p.avatar_url as owner_avatar,
    COUNT(*) OVER() as total_count
  FROM listings l
  JOIN public_profiles p ON p.id = l.owner_id
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
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- 4. Create an RPC to safely calculate rating summaries
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
  WHERE l.owner_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
