-- Meta Ads Autopilot Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Restaurants table
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  location JSONB NOT NULL DEFAULT '{"lat": 0, "lng": 0, "address": ""}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ad Set Categories table (predefined)
CREATE TABLE ad_set_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_category TEXT NOT NULL,
  targeting_template JSONB DEFAULT '{}',
  requires_delivery BOOLEAN NOT NULL DEFAULT FALSE,
  is_event_type BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ad Sets table
CREATE TABLE ad_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES ad_set_categories(id),
  meta_ad_set_id TEXT,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  ads_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED')),
  event_identifier TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts table
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  ad_set_id UUID REFERENCES ad_sets(id),
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

-- Events table
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

-- Indexes for performance
CREATE INDEX idx_posts_restaurant ON posts(restaurant_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_promotion_end ON posts(promotion_end_date) WHERE status = 'ACTIVE';
CREATE INDEX idx_ad_sets_restaurant ON ad_sets(restaurant_id);
CREATE INDEX idx_ad_sets_category ON ad_sets(category_id);
CREATE INDEX idx_events_restaurant ON events(restaurant_id);
CREATE INDEX idx_restaurants_page_id ON restaurants(facebook_page_id);

-- Function to increment ad set count
CREATE OR REPLACE FUNCTION increment_ad_set_count(ad_set_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE ad_sets 
  SET ads_count = ads_count + 1 
  WHERE id = ad_set_id;
END;
$$ LANGUAGE plpgsql;

-- Insert predefined ad set categories
INSERT INTO ad_set_categories (code, name, parent_category, requires_delivery, is_event_type) VALUES
  ('EV_ALL', 'Event > Wszyscy', 'Event', FALSE, TRUE),
  ('EV_FAM', 'Event > Rodzina', 'Event', FALSE, TRUE),
  ('EV_PAR', 'Event > Para', 'Event', FALSE, TRUE),
  ('EV_SEN', 'Event > Senior', 'Event', FALSE, TRUE),
  ('LU_ONS', 'Lunch > On-site', 'Lunch', FALSE, FALSE),
  ('LU_DEL', 'Lunch > Delivery', 'Lunch', TRUE, FALSE),
  ('PR_ONS_CYK', 'Promo > On-site > Cykliczna', 'Promo', FALSE, FALSE),
  ('PR_ONS_JED', 'Promo > On-site > Jednorazowa', 'Promo', FALSE, FALSE),
  ('PR_DEL_CYK', 'Promo > Delivery > Cykliczna', 'Promo', TRUE, FALSE),
  ('PR_DEL_JED', 'Promo > Delivery > Jednorazowa', 'Promo', TRUE, FALSE),
  ('PD_ONS', 'Product > On-site', 'Product', FALSE, FALSE),
  ('PD_DEL', 'Product > Delivery', 'Product', TRUE, FALSE),
  ('BRAND', 'Brand', 'Brand', FALSE, FALSE),
  ('INFO', 'Info', 'Info', FALSE, FALSE);

-- Disable RLS for simplicity (no auth required)
ALTER TABLE restaurants DISABLE ROW LEVEL SECURITY;
ALTER TABLE ad_set_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE ad_sets DISABLE ROW LEVEL SECURITY;
ALTER TABLE posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
