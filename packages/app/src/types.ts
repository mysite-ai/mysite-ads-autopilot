export interface Restaurant {
  id: string;
  name: string;
  code: string;
  website: string;
  area: 'S-CITY' | 'M-CITY' | 'L-CITY';
  fame: 'Neutral' | 'Hot' | 'Epic';
  delivery_radius_km: number;
  budget_priorities: Record<string, number>;
  facebook_page_id: string;
  instagram_account_id: string;
  meta_campaign_id: string | null;
  location: { lat: number; lng: number; address: string };
  created_at: string;
}

export interface AdSetCategory {
  id: string;
  code: string;
  name: string;
  parent_category: string;
  targeting_template: Record<string, unknown>;
  requires_delivery: boolean;
  is_event_type: boolean;
  created_at: string;
}

export interface AdSet {
  id: string;
  restaurant_id: string;
  category_id: string;
  meta_ad_set_id: string | null;
  name: string;
  version: number;
  ads_count: number;
  status: 'ACTIVE' | 'PAUSED';
  event_identifier: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  restaurant_id: string;
  ad_set_id: string | null;
  meta_post_id: string;
  meta_ad_id: string | null;
  meta_creative_id: string | null;
  content: string;
  category_code: string | null;
  event_date: string | null;
  promotion_end_date: string | null;
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'EXPIRED';
  ayrshare_payload: Record<string, unknown>;
  created_at: string;
}

export type CreateRestaurantDto = Omit<Restaurant, 'id' | 'meta_campaign_id' | 'created_at'>;
