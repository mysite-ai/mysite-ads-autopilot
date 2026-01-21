import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type OfferType = 'event' | 'lunch' | 'promo' | 'product' | 'brand' | 'info';
export type OpportunityStatus = 'draft' | 'active' | 'paused' | 'completed';
export type OpportunityGoal = 'traffic' | 'leads' | 'orders' | 'awareness';

export interface Platform {
  pi: number;
  name: string;
  type: 'paid' | 'organic' | 'partner';
  utm_medium: string;
  created_at: string;
}

export interface Restaurant {
  id: string;
  rid: number;
  slug: string;
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

export interface Opportunity {
  id: string;
  pk: number;
  rid: number;
  name: string;
  slug: string;
  goal: OpportunityGoal;
  offer_type: OfferType;
  start_date: string | null;
  end_date: string | null;
  status: OpportunityStatus;
  metadata: Record<string, unknown>;
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
  offer_type: OfferType;
  created_at: string;
}

export interface AdSet {
  id: string;
  restaurant_id: string;
  category_id: string;
  opportunity_id: string | null;
  pk: number | null;
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
  opportunity_id: string | null;
  pk: number | null;
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

export interface TrackingLink {
  id: string;
  rid: number;
  pi: number;
  pk: number;
  ad_id: string | null;
  destination_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string | null;
  utm_term: string | null;
  c_param: string;
  final_url: string;
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

  // =============================================
  // PLATFORMS
  // =============================================
  async getPlatforms(): Promise<Platform[]> {
    const cached = this.getCache<Platform[]>('platforms');
    if (cached) return cached;

    const { data, error } = await this.client
      .from('platforms')
      .select('*')
      .order('pi');
    if (error) throw error;
    
    const result = data || [];
    this.setCache('platforms', result);
    return result;
  }

  async getPlatform(pi: number): Promise<Platform | null> {
    const platforms = await this.getPlatforms();
    return platforms.find(p => p.pi === pi) || null;
  }

  // =============================================
  // OPPORTUNITIES
  // =============================================
  async getOpportunities(rid?: number): Promise<Opportunity[]> {
    const cacheKey = rid ? `opportunities:${rid}` : 'opportunities:all';
    const cached = this.getCache<Opportunity[]>(cacheKey);
    if (cached) return cached;

    let query = this.client.from('opportunities').select('*');
    if (rid) query = query.eq('rid', rid);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    
    const result = data || [];
    this.setCache(cacheKey, result);
    return result;
  }

  async getOpportunity(id: string): Promise<Opportunity | null> {
    const { data, error } = await this.client
      .from('opportunities')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getOpportunityByPk(rid: number, pk: number): Promise<Opportunity | null> {
    const { data, error } = await this.client
      .from('opportunities')
      .select('*')
      .eq('rid', rid)
      .eq('pk', pk)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getActiveOpportunityByOfferType(rid: number, offerType: OfferType): Promise<Opportunity | null> {
    const { data, error } = await this.client
      .from('opportunities')
      .select('*')
      .eq('rid', rid)
      .eq('offer_type', offerType)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async createOpportunity(opportunity: Partial<Opportunity>): Promise<Opportunity> {
    const { data, error } = await this.client
      .from('opportunities')
      .insert(opportunity)
      .select()
      .single();
    if (error) throw error;
    this.invalidateCache('opportunities');
    return data;
  }

  async updateOpportunity(id: string, updates: Partial<Opportunity>): Promise<Opportunity> {
    const { data, error } = await this.client
      .from('opportunities')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    this.invalidateCache('opportunities');
    return data;
  }

  async deleteOpportunity(id: string): Promise<void> {
    const { error } = await this.client.from('opportunities').delete().eq('id', id);
    if (error) throw error;
    this.invalidateCache('opportunities');
  }

  async getNextOpportunityPk(rid: number): Promise<number> {
    const { data, error } = await this.client
      .from('opportunities')
      .select('pk')
      .eq('rid', rid)
      .order('pk', { ascending: false })
      .limit(1);
    if (error) throw error;
    return (data?.[0]?.pk || 0) + 1;
  }

  // =============================================
  // TRACKING LINKS
  // =============================================
  async getTrackingLinks(rid?: number, pk?: number): Promise<TrackingLink[]> {
    let query = this.client.from('tracking_links').select('*');
    if (rid) query = query.eq('rid', rid);
    if (pk) query = query.eq('pk', pk);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async createTrackingLink(link: Partial<TrackingLink>): Promise<TrackingLink> {
    const { data, error } = await this.client
      .from('tracking_links')
      .insert(link)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // =============================================
  // UPDATED AD SET METHODS (with PK support)
  // =============================================
  async getAdSetForCategoryAndPk(
    restaurantId: string,
    categoryCode: string,
    pk: number,
    eventIdentifier?: string,
  ): Promise<AdSet | null> {
    const category = await this.getAdSetCategory(categoryCode);
    if (!category) return null;

    let query = this.client
      .from('ad_sets')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('category_id', category.id)
      .eq('pk', pk)
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

  async getNextAdSetVersionForPk(restaurantId: string, categoryId: string, pk: number): Promise<number> {
    const { data, error } = await this.client
      .from('ad_sets')
      .select('version')
      .eq('restaurant_id', restaurantId)
      .eq('category_id', categoryId)
      .eq('pk', pk)
      .order('version', { ascending: false })
      .limit(1);
    if (error) throw error;
    return (data?.[0]?.version || 0) + 1;
  }

  // Get restaurant by rid (numeric ID)
  async getRestaurantByRid(rid: number): Promise<Restaurant | null> {
    const all = await this.getRestaurants();
    return all.find(r => r.rid === rid) || null;
  }
}
