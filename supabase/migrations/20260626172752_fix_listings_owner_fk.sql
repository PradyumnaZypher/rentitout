/*
# Fix listings.owner_id foreign key to reference profiles directly

## Problem
The `listings.owner_id` column references `auth.users(id)` indirectly.
The Supabase REST API cannot detect the foreign key relationship between
`listings` and `profiles` for JOIN queries like `select('*, owner:profiles(*)')`.

## Solution
Drop the existing foreign key to `auth.users(id)` and recreate it pointing
directly to `profiles(id)`. The `profiles` table already references `auth.users(id)`
with `ON DELETE CASCADE`, so this change maintains the same behavior while enabling
the REST API to resolve the `owner:profiles(*)` join.

## Tables modified
- `listings` — `owner_id` FK target changed from `auth.users(id)` to `profiles(id)`
*/

ALTER TABLE listings
DROP CONSTRAINT IF EXISTS listings_owner_id_fkey;

ALTER TABLE listings
ADD CONSTRAINT listings_owner_id_fkey
FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;
