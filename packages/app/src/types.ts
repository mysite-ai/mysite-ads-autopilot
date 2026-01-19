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
  instagram_account_id: string | null;
  meta_campaign_id: string | null;
  location: { lat: number; lng: number; address: string };
  created_at: string;
}

export interface TargetingTemplate {
  age_min: number;
  age_max: number;
  genders: number[]; // 0 = all, 1 = male, 2 = female
  interests: Array<{ id: string; name: string }>;
}

export interface AdSetCategory {
  id: string;
  code: string;
  name: string;
  parent_category: string;
  targeting_template: TargetingTemplate;
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

export interface Event {
  id: string;
  restaurant_id: string;
  ad_set_id: string;
  identifier: string;
  name: string;
  event_date: string;
  created_at: string;
}

export type CreateRestaurantDto = Omit<Restaurant, 'id' | 'meta_campaign_id' | 'created_at'> & {
  meta_campaign_id?: string | null;
};

// Predefiniowane zainteresowania Meta dla restauracji
export const RESTAURANT_INTERESTS = [
  { id: '6003384248805', name: 'Jedzenie' },
  { id: '6003107902433', name: 'Restauracje' },
  { id: '6003139266461', name: 'Fast food' },
  { id: '6003348604980', name: 'Fine dining' },
  { id: '6003295028191', name: 'Pizza' },
  { id: '6003327847662', name: 'Kawa' },
  { id: '6003629569625', name: 'Wino' },
  { id: '6003548707756', name: 'Piwo' },
  { id: '6003020834693', name: 'Kuchnia włoska' },
  { id: '6003268718254', name: 'Kuchnia azjatycka' },
  { id: '6003384248805', name: 'Jedzenie i napoje' },
  { id: '6003277229969', name: 'Gotowanie' },
  { id: '6003397425735', name: 'Zdrowe odżywianie' },
  { id: '6003012317397', name: 'Weganizm' },
  { id: '6003476182657', name: 'Rodzina' },
  { id: '6003305057498', name: 'Rodzicielstwo' },
  { id: '6003139892773', name: 'Randki' },
  { id: '6003384235085', name: 'Życie nocne' },
  { id: '6003107408097', name: 'Podróże' },
  { id: '6003349442805', name: 'Zakupy i moda' },
];
