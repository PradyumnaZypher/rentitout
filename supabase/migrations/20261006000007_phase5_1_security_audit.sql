-- Phase 5.1: Security Audit Fixes

-- 1. Fix handle_new_user search_path vulnerability
-- The handle_new_user trigger function lacked a safe explicit search_path
-- in the baseline migration (20260626173112_rentitout_schema.sql), which 
-- could theoretically allow malicious search_path manipulation since it is 
-- SECURITY DEFINER.
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
