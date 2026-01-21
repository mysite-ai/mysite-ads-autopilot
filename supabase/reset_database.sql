-- =============================================
-- RESET DATABASE
-- Drops everything, then run schema.sql
-- =============================================

-- Drop all tables with CASCADE (handles dependencies)
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS tracking_links CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS ad_sets CASCADE;
DROP TABLE IF EXISTS opportunities CASCADE;
DROP TABLE IF EXISTS ad_set_categories CASCADE;
DROP TABLE IF EXISTS restaurants CASCADE;
DROP TABLE IF EXISTS platforms CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS increment_ad_set_count CASCADE;
DROP FUNCTION IF EXISTS generate_slug CASCADE;
DROP FUNCTION IF EXISTS generate_restaurant_slug CASCADE;
DROP FUNCTION IF EXISTS generate_opportunity_slug CASCADE;
DROP FUNCTION IF EXISTS get_next_opportunity_pk CASCADE;

-- Done! Now run schema.sql
SELECT 'Database reset complete. Run schema.sql now.' as status;
