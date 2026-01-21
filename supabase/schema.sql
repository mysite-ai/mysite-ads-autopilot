-- =============================================
-- META ADS AUTOPILOT - DATABASE SCHEMA v2
-- Multi-channel attribution system
-- =============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PLATFORMS (static lookup for attribution)
-- PI = Platform ID used in tracking URLs
-- =============================================
CREATE TABLE platforms (
  pi INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('paid', 'organic', 'partner')),
  utm_medium TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO platforms (pi, name, type, utm_medium) VALUES
  (1, 'Meta Ads', 'paid', 'meta'),
  (2, 'Google Ads', 'paid', 'google'),
  (3, 'Email / CRM', 'organic', 'email'),
  (4, 'Influencer / Partner', 'partner', 'influencer'),
  (5, 'Marketplace', 'partner', 'marketplace');

-- =============================================
-- RESTAURANTS
-- RID = Restaurant ID used in attribution URLs (r={rid})
-- Slug = URL-safe name for campaign naming ({rid}-{slug})
-- =============================================
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rid SERIAL UNIQUE,
  slug TEXT UNIQUE,
  name TEXT NOT NULL,
  website TEXT,
  facebook_page_id TEXT NOT NULL,
  instagram_account_id TEXT,
  meta_campaign_id TEXT,
  meta_pixel_id TEXT,
  area TEXT NOT NULL DEFAULT 'M-CITY' CHECK (area IN ('S-CITY', 'M-CITY', 'L-CITY')),
  delivery_radius_km INTEGER NOT NULL DEFAULT 5,
  location JSONB NOT NULL DEFAULT '{"lat": 0, "lng": 0, "address": ""}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate slug from name (Polish chars → ASCII)
CREATE OR REPLACE FUNCTION generate_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lower(NEW.name);
    NEW.slug := regexp_replace(NEW.slug, '[ąĄ]', 'a', 'g');
    NEW.slug := regexp_replace(NEW.slug, '[ęĘ]', 'e', 'g');
    NEW.slug := regexp_replace(NEW.slug, '[óÓ]', 'o', 'g');
    NEW.slug := regexp_replace(NEW.slug, '[śŚ]', 's', 'g');
    NEW.slug := regexp_replace(NEW.slug, '[łŁ]', 'l', 'g');
    NEW.slug := regexp_replace(NEW.slug, '[żŻźŹ]', 'z', 'g');
    NEW.slug := regexp_replace(NEW.slug, '[ćĆ]', 'c', 'g');
    NEW.slug := regexp_replace(NEW.slug, '[ńŃ]', 'n', 'g');
    NEW.slug := regexp_replace(NEW.slug, '[^a-z0-9]+', '-', 'g');
    NEW.slug := regexp_replace(NEW.slug, '^-|-$', '', 'g');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_restaurant_slug BEFORE INSERT OR UPDATE ON restaurants
  FOR EACH ROW EXECUTE FUNCTION generate_slug();

-- =============================================
-- AD SET CATEGORIES (targeting templates)
-- Code = category identifier (EV_ALL, LU_ONS, etc.)
-- =============================================
CREATE TABLE ad_set_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  offer_type TEXT NOT NULL CHECK (offer_type IN ('event', 'lunch', 'promo', 'product', 'brand', 'info')),
  targeting_template JSONB DEFAULT '{}',
  requires_delivery BOOLEAN NOT NULL DEFAULT FALSE,
  is_event_type BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO ad_set_categories (code, name, offer_type, requires_delivery, is_event_type) VALUES
  ('EV_ALL', 'Event > Wszyscy', 'event', FALSE, TRUE),
  ('EV_FAM', 'Event > Rodzina', 'event', FALSE, TRUE),
  ('EV_PAR', 'Event > Para', 'event', FALSE, TRUE),
  ('EV_SEN', 'Event > Senior', 'event', FALSE, TRUE),
  ('LU_ONS', 'Lunch > On-site', 'lunch', FALSE, FALSE),
  ('LU_DEL', 'Lunch > Delivery', 'lunch', TRUE, FALSE),
  ('PR_ONS_CYK', 'Promo > On-site > Cykliczna', 'promo', FALSE, FALSE),
  ('PR_ONS_JED', 'Promo > On-site > Jednorazowa', 'promo', FALSE, FALSE),
  ('PR_DEL_CYK', 'Promo > Delivery > Cykliczna', 'promo', TRUE, FALSE),
  ('PR_DEL_JED', 'Promo > Delivery > Jednorazowa', 'promo', TRUE, FALSE),
  ('PD_ONS', 'Product > On-site', 'product', FALSE, FALSE),
  ('PD_DEL', 'Product > Delivery', 'product', TRUE, FALSE),
  ('BRAND', 'Brand', 'brand', FALSE, FALSE),
  ('INFO', 'Info', 'info', FALSE, FALSE);

-- =============================================
-- OPPORTUNITIES (marketing campaigns/promotions)
-- PK = Opportunity Key used in attribution (pk={pk})
-- One PK can have multiple ad sets and ads
-- =============================================
CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pk SERIAL,
  rid INTEGER NOT NULL REFERENCES restaurants(rid) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  offer_type TEXT NOT NULL CHECK (offer_type IN ('event', 'lunch', 'promo', 'product', 'brand', 'info')),
  goal TEXT NOT NULL DEFAULT 'traffic' CHECK (goal IN ('traffic', 'leads', 'orders', 'awareness')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  start_date DATE,
  end_date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rid, pk)
);

CREATE TRIGGER tr_opportunity_slug BEFORE INSERT OR UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION generate_slug();

-- =============================================
-- AD SETS (Meta Ad Sets with targeting from category)
-- Name format: pk{PK}_{category_code}_v{version}
-- =============================================
CREATE TABLE ad_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES ad_set_categories(id),
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  pk INTEGER,
  meta_ad_set_id TEXT,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  ads_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED')),
  event_identifier TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- POSTS (Facebook posts promoted as Meta Ads)
-- Name format: pk{PK}_{meta_ad_id}
-- =============================================
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  ad_set_id UUID REFERENCES ad_sets(id),
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  pk INTEGER,
  meta_post_id TEXT NOT NULL UNIQUE,
  meta_ad_id TEXT,
  meta_creative_id TEXT,
  content TEXT,
  category_code TEXT,
  event_date DATE,
  promotion_end_date DATE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'PAUSED', 'EXPIRED')),
  ayrshare_payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- EVENTS (calendar events for event-type ads)
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
-- TRACKING LINKS (generated URLs for attribution)
-- URL format: ?r={rid}&c=.pi{pi}.pk{pk}.ps{ps}&utm_*
-- =============================================
CREATE TABLE tracking_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rid INTEGER NOT NULL REFERENCES restaurants(rid) ON DELETE CASCADE,
  pi INTEGER NOT NULL REFERENCES platforms(pi) DEFAULT 1,
  pk INTEGER NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  destination_url TEXT NOT NULL,
  final_url TEXT NOT NULL,
  c_param TEXT NOT NULL,
  utm_source TEXT NOT NULL DEFAULT 'mysite',
  utm_medium TEXT NOT NULL,
  utm_campaign TEXT NOT NULL,
  utm_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- AUDIT LOG (for debugging)
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
-- INDEXES
-- =============================================
CREATE INDEX idx_restaurants_rid ON restaurants(rid);
CREATE INDEX idx_restaurants_fb ON restaurants(facebook_page_id);

CREATE INDEX idx_opportunities_rid ON opportunities(rid);
CREATE INDEX idx_opportunities_status ON opportunities(status);

CREATE INDEX idx_ad_sets_restaurant ON ad_sets(restaurant_id);
CREATE INDEX idx_ad_sets_pk ON ad_sets(pk);

CREATE INDEX idx_posts_restaurant ON posts(restaurant_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_pk ON posts(pk);

CREATE INDEX idx_tracking_links_rid_pk ON tracking_links(rid, pk);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================
CREATE OR REPLACE FUNCTION increment_ad_set_count(p_ad_set_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE ad_sets SET ads_count = ads_count + 1 WHERE id = p_ad_set_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- DISABLE RLS (no auth)
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
