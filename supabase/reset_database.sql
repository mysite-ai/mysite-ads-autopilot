-- =============================================
-- RESET DATABASE - USUWA WSZYSTKIE DANE!
-- =============================================
-- UWAGA: Ten skrypt usunie WSZYSTKIE tabele i dane!
-- Uruchom tylko jeśli chcesz zacząć od zera.
-- =============================================

-- Usuń tabele w odpowiedniej kolejności (ze względu na foreign keys)
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS tracking_links CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS ad_sets CASCADE;
DROP TABLE IF EXISTS opportunities CASCADE;
DROP TABLE IF EXISTS ad_set_categories CASCADE;
DROP TABLE IF EXISTS restaurants CASCADE;
DROP TABLE IF EXISTS platforms CASCADE;

-- Usuń funkcje
DROP FUNCTION IF EXISTS increment_ad_set_count(UUID);
DROP FUNCTION IF EXISTS get_next_opportunity_pk(INTEGER);
DROP FUNCTION IF EXISTS generate_restaurant_slug();
DROP FUNCTION IF EXISTS generate_opportunity_slug();

-- Usuń triggery (jeśli istnieją)
DROP TRIGGER IF EXISTS trigger_generate_restaurant_slug ON restaurants;
DROP TRIGGER IF EXISTS trigger_generate_opportunity_slug ON opportunities;

-- =============================================
-- GOTOWE! Baza jest pusta.
-- Teraz uruchom schema.sql aby utworzyć nowe tabele.
-- =============================================
