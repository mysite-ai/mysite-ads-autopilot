-- Meta Ads Autopilot Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PLATFORMS TABLE (static lookup)
-- =============================================
CREATE TABLE platforms (
  pi INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('paid', 'organic', 'partner')),
  utm_medium TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert platform definitions
INSERT INTO platforms (pi, name, type, utm_medium) VALUES
  (1, 'Meta Ads', 'paid', 'meta'),
  (2, 'Google Ads', 'paid', 'google'),
  (3, 'Email / CRM', 'organic', 'email'),
  (4, 'Influencer / Partner', 'partner', 'influencer'),
  (5, 'Marketplace', 'partner', 'marketplace');

-- =============================================
-- RESTAURANTS TABLE (with rid/slug for attribution)
-- =============================================
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rid SERIAL UNIQUE,  -- Numeric Restaurant ID for attribution (auto-increment)
  slug TEXT UNIQUE,   -- URL-safe slug for campaign naming
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  website TEXT,
  area TEXT NOT NULL CHECK (area IN ('S-CITY', 'M-CITY', 'L-CITY')),
  fame TEXT NOT NULL DEFAULT 'Neutral' CHECK (fame IN ('Neutral', 'Hot', 'Epic')),
  delivery_radius_km INTEGER NOT NULL DEFAULT 5,
  budget_priorities JSONB NOT NULL DEFAULT '{"Event": 20, "Lunch": 20, "Promo": 25, "Product": 15, "Brand": 10, "Info": 10}',
  facebook_page_id TEXT NOT NULL,
  instagram_account_id TEXT,
  meta_campaign_id TEXT,
  meta_pixel_id TEXT,
  location JSONB NOT NULL DEFAULT '{"lat": 0, "lng": 0, "address": ""}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to auto-generate slug from name
CREATE OR REPLACE FUNCTION generate_restaurant_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lower(regexp_replace(
      regexp_replace(NEW.name, '[ąĄ]', 'a', 'g'),
      '[ęĘ]', 'e', 'g'
    ));
    NEW.slug := lower(regexp_replace(NEW.slug, '[óÓ]', 'o', 'g'));
    NEW.slug := lower(regexp_replace(NEW.slug, '[śŚ]', 's', 'g'));
    NEW.slug := lower(regexp_replace(NEW.slug, '[łŁ]', 'l', 'g'));
    NEW.slug := lower(regexp_replace(NEW.slug, '[żŻźŹ]', 'z', 'g'));
    NEW.slug := lower(regexp_replace(NEW.slug, '[ćĆ]', 'c', 'g'));
    NEW.slug := lower(regexp_replace(NEW.slug, '[ńŃ]', 'n', 'g'));
    NEW.slug := lower(regexp_replace(NEW.slug, '[^a-z0-9]+', '-', 'g'));
    NEW.slug := lower(regexp_replace(NEW.slug, '^-|-$', '', 'g'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_restaurant_slug
  BEFORE INSERT OR UPDATE ON restaurants
  FOR EACH ROW
  EXECUTE FUNCTION generate_restaurant_slug();

-- Migration for existing databases:
-- ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS rid SERIAL UNIQUE;
-- ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
-- ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS meta_pixel_id TEXT;

-- =============================================
-- AD SET CATEGORIES TABLE (predefined targeting templates)
-- =============================================
CREATE TABLE ad_set_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_category TEXT NOT NULL,
  targeting_template JSONB DEFAULT '{}',
  requires_delivery BOOLEAN NOT NULL DEFAULT FALSE,
  is_event_type BOOLEAN NOT NULL DEFAULT FALSE,
  offer_type TEXT NOT NULL DEFAULT 'info' CHECK (offer_type IN ('event', 'lunch', 'promo', 'product', 'brand', 'info')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- OPPORTUNITIES TABLE (PK = Opportunity Key for attribution)
-- =============================================
CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pk SERIAL,  -- Auto-increment Opportunity Key
  rid INTEGER NOT NULL REFERENCES restaurants(rid) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  goal TEXT NOT NULL DEFAULT 'traffic' CHECK (goal IN ('traffic', 'leads', 'orders', 'awareness')),
  offer_type TEXT NOT NULL CHECK (offer_type IN ('event', 'lunch', 'promo', 'product', 'brand', 'info')),
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rid, pk)
);

-- Function to auto-generate opportunity slug
CREATE OR REPLACE FUNCTION generate_opportunity_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
    NEW.slug := lower(regexp_replace(NEW.slug, '^-|-$', '', 'g'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_opportunity_slug
  BEFORE INSERT OR UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION generate_opportunity_slug();

-- =============================================
-- AD SETS TABLE (with PK reference for attribution)
-- =============================================
CREATE TABLE ad_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES ad_set_categories(id),
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  pk INTEGER,  -- Opportunity Key for attribution (denormalized for easy access)
  meta_ad_set_id TEXT,
  name TEXT NOT NULL,  -- Format: pk{PK}_{category_code}_v{n}
  version INTEGER NOT NULL DEFAULT 1,
  ads_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED')),
  event_identifier TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- POSTS TABLE (ads/creatives with PK for attribution)
-- =============================================
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  ad_set_id UUID REFERENCES ad_sets(id),
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  pk INTEGER,  -- Opportunity Key for attribution (denormalized)
  meta_post_id TEXT NOT NULL,
  meta_ad_id TEXT,
  meta_creative_id TEXT,
  content TEXT,
  category_code TEXT,
  event_date DATE,
  promotion_end_date DATE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'PAUSED', 'EXPIRED')),
  ayrshare_payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meta_post_id)
);

-- =============================================
-- EVENTS TABLE (calendar events linked to ad sets)
-- =============================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  ad_set_id UUID NOT NULL REFERENCES ad_sets(id) ON DELETE CASCADE,
  identifier TEXT NOT NULL,
  name TEXT NOT NULL,
  event_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, identifier)
);

-- =============================================
-- TRACKING LINKS TABLE (generated URLs with UTM params)
-- =============================================
CREATE TABLE tracking_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rid INTEGER NOT NULL REFERENCES restaurants(rid) ON DELETE CASCADE,
  pi INTEGER NOT NULL REFERENCES platforms(pi) DEFAULT 1,
  pk INTEGER NOT NULL,
  ad_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  destination_url TEXT NOT NULL,
  utm_source TEXT NOT NULL DEFAULT 'mysite',
  utm_medium TEXT NOT NULL,
  utm_campaign TEXT NOT NULL,
  utm_content TEXT,
  utm_term TEXT,
  c_param TEXT NOT NULL,  -- Format: .pi{PI}.pk{PK}.ps{PS}
  final_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- AUDIT LOG TABLE (for debugging and tracking changes)
-- =============================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'sync')),
  changes JSONB,
  actor TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Restaurants indexes
CREATE INDEX idx_restaurants_page_id ON restaurants(facebook_page_id);
CREATE INDEX idx_restaurants_rid ON restaurants(rid);

-- Opportunities indexes
CREATE INDEX idx_opportunities_rid ON opportunities(rid);
CREATE INDEX idx_opportunities_pk ON opportunities(pk);
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_offer_type ON opportunities(offer_type);

-- Ad Sets indexes
CREATE INDEX idx_ad_sets_restaurant ON ad_sets(restaurant_id);
CREATE INDEX idx_ad_sets_category ON ad_sets(category_id);
CREATE INDEX idx_ad_sets_opportunity ON ad_sets(opportunity_id);
CREATE INDEX idx_ad_sets_pk ON ad_sets(pk);

-- Posts indexes
CREATE INDEX idx_posts_restaurant ON posts(restaurant_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_promotion_end ON posts(promotion_end_date) WHERE status = 'ACTIVE';
CREATE INDEX idx_posts_pk ON posts(pk);
CREATE INDEX idx_posts_opportunity ON posts(opportunity_id);

-- Events indexes
CREATE INDEX idx_events_restaurant ON events(restaurant_id);

-- Tracking Links indexes
CREATE INDEX idx_tracking_links_rid ON tracking_links(rid);
CREATE INDEX idx_tracking_links_pk ON tracking_links(pk);
CREATE INDEX idx_tracking_links_rid_pk ON tracking_links(rid, pk);

-- Audit Log indexes
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- Function to increment ad set count
CREATE OR REPLACE FUNCTION increment_ad_set_count(ad_set_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE ad_sets 
  SET ads_count = ads_count + 1 
  WHERE id = ad_set_id;
END;
$$ LANGUAGE plpgsql;

-- Insert predefined ad set categories with offer_type for attribution
INSERT INTO ad_set_categories (code, name, parent_category, requires_delivery, is_event_type, offer_type) VALUES
  ('EV_ALL', 'Event > Wszyscy', 'Event', FALSE, TRUE, 'event'),
  ('EV_FAM', 'Event > Rodzina', 'Event', FALSE, TRUE, 'event'),
  ('EV_PAR', 'Event > Para', 'Event', FALSE, TRUE, 'event'),
  ('EV_SEN', 'Event > Senior', 'Event', FALSE, TRUE, 'event'),
  ('LU_ONS', 'Lunch > On-site', 'Lunch', FALSE, FALSE, 'lunch'),
  ('LU_DEL', 'Lunch > Delivery', 'Lunch', TRUE, FALSE, 'lunch'),
  ('PR_ONS_CYK', 'Promo > On-site > Cykliczna', 'Promo', FALSE, FALSE, 'promo'),
  ('PR_ONS_JED', 'Promo > On-site > Jednorazowa', 'Promo', FALSE, FALSE, 'promo'),
  ('PR_DEL_CYK', 'Promo > Delivery > Cykliczna', 'Promo', TRUE, FALSE, 'promo'),
  ('PR_DEL_JED', 'Promo > Delivery > Jednorazowa', 'Promo', TRUE, FALSE, 'promo'),
  ('PD_ONS', 'Product > On-site', 'Product', FALSE, FALSE, 'product'),
  ('PD_DEL', 'Product > Delivery', 'Product', TRUE, FALSE, 'product'),
  ('BRAND', 'Brand', 'Brand', FALSE, FALSE, 'brand'),
  ('INFO', 'Info', 'Info', FALSE, FALSE, 'info');

-- =============================================
-- DISABLE RLS FOR SIMPLICITY (no auth required)
-- =============================================
ALTER TABLE platforms DISABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants DISABLE ROW LEVEL SECURITY;
ALTER TABLE ad_set_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities DISABLE ROW LEVEL SECURITY;
ALTER TABLE ad_sets DISABLE ROW LEVEL SECURITY;
ALTER TABLE posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_links DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;

-- =============================================
-- HELPER FUNCTION: Get next PK for a restaurant
-- =============================================
CREATE OR REPLACE FUNCTION get_next_opportunity_pk(p_rid INTEGER)
RETURNS INTEGER AS $$
DECLARE
  next_pk INTEGER;
BEGIN
  SELECT COALESCE(MAX(pk), 0) + 1 INTO next_pk
  FROM opportunities
  WHERE rid = p_rid;
  RETURN next_pk;
END;
$$ LANGUAGE plpgsql;
