-- Phase 4: Add pagination and total_count to search_listings_advanced

DROP FUNCTION IF EXISTS search_listings_advanced(text, double precision, double precision, text[], text[], numeric, numeric, text, text);

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
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;
