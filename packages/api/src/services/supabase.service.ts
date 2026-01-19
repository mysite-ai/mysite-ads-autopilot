import { Injectable, Logger } from '@nestjs/common';
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
  meta_pixel_id: string | null;
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

// Simple in-memory cache
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 30000; // 30 seconds

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient;
  
  // Cache
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  constructor(private config: ConfigService) {
    this.client = createClient(
      this.config.getOrThrow('SUPABASE_URL'),
      this.config.getOrThrow('SUPABASE_SERVICE_KEY'),
    );
  }

  private getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
      return entry.data as T;
    }
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private invalidateCache(prefix?: string): void {
    if (prefix) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) this.cache.delete(key);
      }
    } else {
      this.cache.clear();
    }
  }

  // Restaurants (cached)
  async getRestaurants(): Promise<Restaurant[]> {
    const cached = this.getCache<Restaurant[]>('restaurants');
    if (cached) return cached;

    const { data, error } = await this.client
      .from('restaurants')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    
    const result = data || [];
    this.setCache('restaurants', result);
    return result;
  }

  async getRestaurant(id: string): Promise<Restaurant | null> {
    const all = await this.getRestaurants();
    return all.find(r => r.id === id) || null;
  }

  async getRestaurantByPageId(pageId: string): Promise<Restaurant | null> {
    const all = await this.getRestaurants();
    return all.find(r => r.facebook_page_id === pageId) || null;
  }

  async createRestaurant(restaurant: Partial<Restaurant>): Promise<Restaurant> {
    const { data, error } = await this.client
      .from('restaurants')
      .insert(restaurant)
      .select()
      .single();
    if (error) throw error;
    this.invalidateCache('restaurants');
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
    this.invalidateCache('restaurants');
    return data;
  }

  async deleteRestaurant(id: string): Promise<void> {
    const { error } = await this.client.from('restaurants').delete().eq('id', id);
    if (error) throw error;
    this.invalidateCache('restaurants');
  }

  // Ad Set Categories (cached - rarely changes)
  async getAdSetCategories(): Promise<AdSetCategory[]> {
    const cached = this.getCache<AdSetCategory[]>('categories');
    if (cached) return cached;

    const { data, error } = await this.client
      .from('ad_set_categories')
      .select('*')
      .order('code');
    if (error) throw error;
    
    const result = data || [];
    this.setCache('categories', result);
    return result;
  }

  async getAdSetCategory(code: string): Promise<AdSetCategory | null> {
    const all = await this.getAdSetCategories();
    return all.find(c => c.code === code) || null;
  }

  async updateAdSetCategory(id: string, updates: Partial<AdSetCategory>): Promise<AdSetCategory> {
    const { data, error } = await this.client
      .from('ad_set_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    this.invalidateCache('categories');
    return data;
  }

  // Ad Sets (cached)
  async getAdSets(restaurantId?: string): Promise<AdSet[]> {
    const cacheKey = restaurantId ? `adsets:${restaurantId}` : 'adsets:all';
    const cached = this.getCache<AdSet[]>(cacheKey);
    if (cached) return cached;

    let query = this.client.from('ad_sets').select('*');
    if (restaurantId) query = query.eq('restaurant_id', restaurantId);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    
    const result = data || [];
    this.setCache(cacheKey, result);
    return result;
  }

  async getAdSetForCategory(
    restaurantId: string,
    categoryCode: string,
    eventIdentifier?: string,
  ): Promise<AdSet | null> {
    const category = await this.getAdSetCategory(categoryCode);
    if (!category) return null;

    // Fresh query for this (needs accurate count)
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

  async getAdSet(id: string): Promise<AdSet | null> {
    const { data, error } = await this.client.from('ad_sets').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async createAdSet(adSet: Partial<AdSet>): Promise<AdSet> {
    const { data, error } = await this.client.from('ad_sets').insert(adSet).select().single();
    if (error) throw error;
    this.invalidateCache('adsets');
    return data;
  }

  async deleteAdSet(id: string): Promise<void> {
    const { error } = await this.client.from('ad_sets').delete().eq('id', id);
    if (error) throw error;
    this.invalidateCache('adsets');
  }

  async incrementAdSetCount(id: string): Promise<void> {
    const { error } = await this.client.rpc('increment_ad_set_count', { ad_set_id: id });
    if (error) throw error;
    this.invalidateCache('adsets');
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

  // Posts (cached)
  async getPosts(restaurantId?: string): Promise<Post[]> {
    const cacheKey = restaurantId ? `posts:${restaurantId}` : 'posts:all';
    const cached = this.getCache<Post[]>(cacheKey);
    if (cached) return cached;

    let query = this.client.from('posts').select('*');
    if (restaurantId) query = query.eq('restaurant_id', restaurantId);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    
    const result = data || [];
    this.setCache(cacheKey, result);
    return result;
  }

  async getPost(id: string): Promise<Post | null> {
    const { data, error } = await this.client.from('posts').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
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

  async deletePost(id: string): Promise<void> {
    const { error } = await this.client.from('posts').delete().eq('id', id);
    if (error) throw error;
    this.invalidateCache('posts');
  }

  async deletePostsByAdSetId(adSetId: string): Promise<void> {
    const { error } = await this.client.from('posts').delete().eq('ad_set_id', adSetId);
    if (error) throw error;
    this.invalidateCache('posts');
  }

  async createPost(post: Partial<Post>): Promise<Post> {
    const { data, error } = await this.client.from('posts').insert(post).select().single();
    if (error) throw error;
    this.invalidateCache('posts');
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
    this.invalidateCache('posts');
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
  async getEvents(restaurantId?: string): Promise<Event[]> {
    let query = this.client.from('events').select('*');
    if (restaurantId) query = query.eq('restaurant_id', restaurantId);
    const { data, error } = await query.order('event_date', { ascending: false });
    if (error) throw error;
    return data || [];
  }

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
    const { data, error } = await this.client.from('events').insert(event).select().single();
    if (error) throw error;
    return data;
  }
}
