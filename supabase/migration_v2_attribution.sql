-- =============================================
-- MIGRATION: Attribution System v2
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Create platforms table (new)
CREATE TABLE IF NOT EXISTS platforms (
  pi INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('paid', 'organic', 'partner')),
  utm_medium TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert platform definitions (ignore if exists)
INSERT INTO platforms (pi, name, type, utm_medium) VALUES
  (1, 'Meta Ads', 'paid', 'meta'),
  (2, 'Google Ads', 'paid', 'google'),
  (3, 'Email / CRM', 'organic', 'email'),
  (4, 'Influencer / Partner', 'partner', 'influencer'),
  (5, 'Marketplace', 'partner', 'marketplace')
ON CONFLICT (pi) DO NOTHING;

-- 2. Add new columns to restaurants
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS rid SERIAL UNIQUE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS meta_pixel_id TEXT;

-- Update slug from code for existing restaurants (if slug is null)
UPDATE restaurants SET slug = LOWER(code) WHERE slug IS NULL;

-- 3. Add offer_type to ad_set_categories
ALTER TABLE ad_set_categories ADD COLUMN IF NOT EXISTS offer_type TEXT DEFAULT 'info';

-- Update offer_type based on parent_category
UPDATE ad_set_categories SET offer_type = 'event' WHERE parent_category = 'Event';
UPDATE ad_set_categories SET offer_type = 'lunch' WHERE parent_category = 'Lunch';
UPDATE ad_set_categories SET offer_type = 'promo' WHERE parent_category = 'Promo';
UPDATE ad_set_categories SET offer_type = 'product' WHERE parent_category = 'Product';
UPDATE ad_set_categories SET offer_type = 'brand' WHERE parent_category = 'Brand';
UPDATE ad_set_categories SET offer_type = 'info' WHERE parent_category = 'Info';

-- Add constraint
ALTER TABLE ad_set_categories DROP CONSTRAINT IF EXISTS ad_set_categories_offer_type_check;
ALTER TABLE ad_set_categories ADD CONSTRAINT ad_set_categories_offer_type_check 
  CHECK (offer_type IN ('event', 'lunch', 'promo', 'product', 'brand', 'info'));

-- 4. Create opportunities table (new)
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pk SERIAL,
  rid INTEGER NOT NULL,
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

-- Add foreign key for opportunities.rid -> restaurants.rid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'opportunities_rid_fkey'
  ) THEN
    ALTER TABLE opportunities ADD CONSTRAINT opportunities_rid_fkey 
      FOREIGN KEY (rid) REFERENCES restaurants(rid) ON DELETE CASCADE;
  END IF;
END $$;

-- 5. Add PK columns to ad_sets
ALTER TABLE ad_sets ADD COLUMN IF NOT EXISTS opportunity_id UUID;
ALTER TABLE ad_sets ADD COLUMN IF NOT EXISTS pk INTEGER;

-- Add foreign key for ad_sets.opportunity_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ad_sets_opportunity_id_fkey'
  ) THEN
    ALTER TABLE ad_sets ADD CONSTRAINT ad_sets_opportunity_id_fkey 
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. Add PK columns to posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS opportunity_id UUID;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS pk INTEGER;

-- Add foreign key for posts.opportunity_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'posts_opportunity_id_fkey'
  ) THEN
    ALTER TABLE posts ADD CONSTRAINT posts_opportunity_id_fkey 
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 7. Create tracking_links table (new)
CREATE TABLE IF NOT EXISTS tracking_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rid INTEGER NOT NULL,
  pi INTEGER NOT NULL DEFAULT 1,
  pk INTEGER NOT NULL,
  ad_id UUID,
  destination_url TEXT NOT NULL,
  utm_source TEXT NOT NULL DEFAULT 'mysite',
  utm_medium TEXT NOT NULL,
  utm_campaign TEXT NOT NULL,
  utm_content TEXT,
  utm_term TEXT,
  c_param TEXT NOT NULL,
  final_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign keys for tracking_links
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tracking_links_rid_fkey'
  ) THEN
    ALTER TABLE tracking_links ADD CONSTRAINT tracking_links_rid_fkey 
      FOREIGN KEY (rid) REFERENCES restaurants(rid) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tracking_links_pi_fkey'
  ) THEN
    ALTER TABLE tracking_links ADD CONSTRAINT tracking_links_pi_fkey 
      FOREIGN KEY (pi) REFERENCES platforms(pi);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tracking_links_ad_id_fkey'
  ) THEN
    ALTER TABLE tracking_links ADD CONSTRAINT tracking_links_ad_id_fkey 
      FOREIGN KEY (ad_id) REFERENCES posts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 8. Create audit_log table (new)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'sync')),
  changes JSONB,
  actor TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Create indexes
CREATE INDEX IF NOT EXISTS idx_restaurants_rid ON restaurants(rid);
CREATE INDEX IF NOT EXISTS idx_opportunities_rid ON opportunities(rid);
CREATE INDEX IF NOT EXISTS idx_opportunities_pk ON opportunities(pk);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_ad_sets_pk ON ad_sets(pk);
CREATE INDEX IF NOT EXISTS idx_ad_sets_opportunity ON ad_sets(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_posts_pk ON posts(pk);
CREATE INDEX IF NOT EXISTS idx_posts_opportunity ON posts(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_tracking_links_rid ON tracking_links(rid);
CREATE INDEX IF NOT EXISTS idx_tracking_links_pk ON tracking_links(pk);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- 10. Disable RLS for new tables
ALTER TABLE platforms DISABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities DISABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_links DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;

-- 11. Helper function: Get next PK for a restaurant
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

-- =============================================
-- DONE! Verify with:
-- SELECT * FROM platforms;
-- SELECT rid, slug, name FROM restaurants;
-- SELECT * FROM opportunities LIMIT 5;
-- =============================================
