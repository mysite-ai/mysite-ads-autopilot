-- =============================================
-- RESET DATABASE - DROPS ALL TABLES!
-- Run this to start fresh, then run schema.sql
-- =============================================

DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS tracking_links CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS ad_sets CASCADE;
DROP TABLE IF EXISTS opportunities CASCADE;
DROP TABLE IF EXISTS ad_set_categories CASCADE;
DROP TABLE IF EXISTS restaurants CASCADE;
DROP TABLE IF EXISTS platforms CASCADE;

DROP FUNCTION IF EXISTS increment_ad_set_count(UUID);
DROP FUNCTION IF EXISTS generate_slug();

DROP TRIGGER IF EXISTS tr_restaurant_slug ON restaurants;
DROP TRIGGER IF EXISTS tr_opportunity_slug ON opportunities;

-- Done! Now run schema.sql
