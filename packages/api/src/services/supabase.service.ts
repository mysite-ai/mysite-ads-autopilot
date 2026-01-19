import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

export interface Event {
  id: string;
  restaurant_id: string;
  ad_set_id: string;
  identifier: string;
  name: string;
  event_date: string;
  created_at: string;
}

@Injectable()
export class SupabaseService {
  private client: SupabaseClient;

  constructor(private config: ConfigService) {
    this.client = createClient(
      this.config.getOrThrow('SUPABASE_URL'),
      this.config.getOrThrow('SUPABASE_SERVICE_KEY'),
    );
  }

  // Restaurants
  async getRestaurants(): Promise<Restaurant[]> {
    const { data, error } = await this.client
      .from('restaurants')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getRestaurant(id: string): Promise<Restaurant | null> {
    const { data, error } = await this.client
      .from('restaurants')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getRestaurantByPageId(pageId: string): Promise<Restaurant | null> {
    const { data, error } = await this.client
      .from('restaurants')
      .select('*')
      .eq('facebook_page_id', pageId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async createRestaurant(restaurant: Partial<Restaurant>): Promise<Restaurant> {
    const { data, error } = await this.client
      .from('restaurants')
      .insert(restaurant)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateRestaurant(id: string, updates: Partial<Restaurant>): Promise<Restaurant> {
    const { data, error } = await this.client
      .from('restaurants')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Ad Set Categories
  async getAdSetCategories(): Promise<AdSetCategory[]> {
    const { data, error } = await this.client
      .from('ad_set_categories')
      .select('*')
      .order('code');
    if (error) throw error;
    return data || [];
  }

  async getAdSetCategory(code: string): Promise<AdSetCategory | null> {
    const { data, error } = await this.client
      .from('ad_set_categories')
      .select('*')
      .eq('code', code)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async updateAdSetCategory(id: string, updates: Partial<AdSetCategory>): Promise<AdSetCategory> {
    const { data, error } = await this.client
      .from('ad_set_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Ad Sets
  async getAdSets(restaurantId?: string): Promise<AdSet[]> {
    let query = this.client.from('ad_sets').select('*');
    if (restaurantId) {
      query = query.eq('restaurant_id', restaurantId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getAdSetForCategory(
    restaurantId: string,
    categoryCode: string,
    eventIdentifier?: string,
  ): Promise<AdSet | null> {
    const category = await this.getAdSetCategory(categoryCode);
    if (!category) return null;

    let query = this.client
      .from('ad_sets')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('category_id', category.id)
      .eq('status', 'ACTIVE')
      .lt('ads_count', 50)
      .order('version', { ascending: false });

    if (eventIdentifier) {
      query = query.eq('event_identifier', eventIdentifier);
    } else {
      query = query.is('event_identifier', null);
    }

    const { data, error } = await query.limit(1).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async createAdSet(adSet: Partial<AdSet>): Promise<AdSet> {
    const { data, error } = await this.client
      .from('ad_sets')
      .insert(adSet)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async incrementAdSetCount(id: string): Promise<void> {
    const { error } = await this.client.rpc('increment_ad_set_count', { ad_set_id: id });
    if (error) throw error;
  }

  async getNextAdSetVersion(restaurantId: string, categoryId: string): Promise<number> {
    const { data, error } = await this.client
      .from('ad_sets')
      .select('version')
      .eq('restaurant_id', restaurantId)
      .eq('category_id', categoryId)
      .order('version', { ascending: false })
      .limit(1);
    if (error) throw error;
    return (data?.[0]?.version || 0) + 1;
  }

  // Posts
  async getPosts(restaurantId?: string): Promise<Post[]> {
    let query = this.client.from('posts').select('*');
    if (restaurantId) {
      query = query.eq('restaurant_id', restaurantId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getPostByMetaId(metaPostId: string): Promise<Post | null> {
    const { data, error } = await this.client
      .from('posts')
      .select('*')
      .eq('meta_post_id', metaPostId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async createPost(post: Partial<Post>): Promise<Post> {
    const { data, error } = await this.client
      .from('posts')
      .insert(post)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updatePost(id: string, updates: Partial<Post>): Promise<Post> {
    const { data, error } = await this.client
      .from('posts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getExpiredPosts(): Promise<Post[]> {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await this.client
      .from('posts')
      .select('*')
      .eq('status', 'ACTIVE')
      .lte('promotion_end_date', today);
    if (error) throw error;
    return data || [];
  }

  // Events
  async getEvent(restaurantId: string, identifier: string): Promise<Event | null> {
    const { data, error } = await this.client
      .from('events')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('identifier', identifier)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async createEvent(event: Partial<Event>): Promise<Event> {
    const { data, error } = await this.client
      .from('events')
      .insert(event)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
