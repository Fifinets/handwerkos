-- Fix RLS policies for offers tables
-- Enable RLS on tables
ALTER TABLE IF EXISTS "public"."offers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "public"."offer_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "public"."offer_targets" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON "public"."offers";
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON "public"."offer_items";
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON "public"."offer_targets";

-- Create permissive policies for authenticated users (Quick Fix)
-- Offers
CREATE POLICY "Enable all access for authenticated users" ON "public"."offers"
AS PERMISSIVE FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Offer Items
CREATE POLICY "Enable all access for authenticated users" ON "public"."offer_items"
AS PERMISSIVE FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Offer Targets
CREATE POLICY "Enable all access for authenticated users" ON "public"."offer_targets"
AS PERMISSIVE FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
