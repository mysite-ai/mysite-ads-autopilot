import type { 
  Restaurant, AdSetCategory, AdSet, Post, Event, 
  CreateRestaurantDto, Opportunity, CreateOpportunityDto,
  Platform, TrackingLink, TrackingLinkParams
} from './types';

const API_BASE = '/api';

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// Restaurants
export const getRestaurants = () => fetchApi<Restaurant[]>('/restaurants');
export const getRestaurant = (id: string) => fetchApi<Restaurant>(`/restaurants/${id}`);
export const createRestaurant = (data: CreateRestaurantDto) => 
  fetchApi<Restaurant>('/restaurants', { method: 'POST', body: JSON.stringify(data) });
export const updateRestaurant = (id: string, data: Partial<CreateRestaurantDto>) =>
  fetchApi<Restaurant>(`/restaurants/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteRestaurant = (id: string) =>
  fetchApi<{ success: boolean }>(`/restaurants/${id}`, { method: 'DELETE' });
export const retryCampaignCreation = (id: string) =>
  fetchApi<Restaurant>(`/restaurants/${id}/retry-campaign`, { method: 'POST' });

// Ad Sets
export const getAdSetCategories = () => fetchApi<AdSetCategory[]>('/ad-sets/categories');
export const updateAdSetCategory = (id: string, data: Partial<AdSetCategory>) =>
  fetchApi<AdSetCategory>(`/ad-sets/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const getAdSets = (restaurantId?: string) => 
  fetchApi<AdSet[]>(`/ad-sets${restaurantId ? `?restaurantId=${restaurantId}` : ''}`);
export const deleteAdSet = (id: string) =>
  fetchApi<{ success: boolean }>(`/ad-sets/${id}`, { method: 'DELETE' });

// Events
export const getEvents = (restaurantId?: string) =>
  fetchApi<Event[]>(`/ad-sets/events${restaurantId ? `?restaurantId=${restaurantId}` : ''}`);

// Posts
export const getPosts = (restaurantId?: string) =>
  fetchApi<Post[]>(`/posts${restaurantId ? `?restaurantId=${restaurantId}` : ''}`);
export const pausePost = (id: string) =>
  fetchApi<Post>(`/posts/${id}/pause`, { method: 'POST' });
export const activatePost = (id: string) =>
  fetchApi<Post>(`/posts/${id}/activate`, { method: 'POST' });
export const addManualPost = (data: { restaurant_id: string; post_id: string; content: string }) =>
  fetchApi<Post>('/posts/manual', { method: 'POST', body: JSON.stringify(data) });
export const retryPost = (id: string) =>
  fetchApi<Post>(`/posts/${id}/retry`, { method: 'POST' });
export const deletePost = (id: string) =>
  fetchApi<{ success: boolean }>(`/posts/${id}`, { method: 'DELETE' });

// Scheduler
export const triggerExpirePosts = () =>
  fetchApi<{ total: number; success: number; failed: number }>('/scheduler/expire-posts', { method: 'POST' });

// =============================================
// OPPORTUNITIES
// =============================================
export const getOpportunities = (rid?: number) =>
  fetchApi<Opportunity[]>(`/opportunities${rid ? `?rid=${rid}` : ''}`);

export const getOpportunity = (id: string) =>
  fetchApi<Opportunity>(`/opportunities/${id}`);

export const createOpportunity = (data: CreateOpportunityDto) =>
  fetchApi<Opportunity>('/opportunities', { method: 'POST', body: JSON.stringify(data) });

export const updateOpportunity = (id: string, data: Partial<CreateOpportunityDto>) =>
  fetchApi<Opportunity>(`/opportunities/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteOpportunity = (id: string) =>
  fetchApi<{ success: boolean }>(`/opportunities/${id}`, { method: 'DELETE' });

// =============================================
// TRACKING LINKS
// =============================================
export const getTrackingLinks = (rid?: number, pk?: number) => {
  const params = new URLSearchParams();
  if (rid) params.set('rid', String(rid));
  if (pk) params.set('pk', String(pk));
  const query = params.toString();
  return fetchApi<TrackingLink[]>(`/tracking-links${query ? `?${query}` : ''}`);
};

export const getPlatforms = () =>
  fetchApi<Platform[]>('/tracking-links/platforms');

export interface GeneratedLink {
  finalUrl: string;
  components: {
    r: string;
    c: string;
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
    utm_content: string;
  };
  saved?: boolean;
}

export const generateTrackingLink = (data: TrackingLinkParams & { save?: boolean }) =>
  fetchApi<GeneratedLink>('/tracking-links/generate', { method: 'POST', body: JSON.stringify(data) });

export const generateMetaTrackingLink = (data: Omit<TrackingLinkParams, 'pi' | 'ps'> & { save?: boolean }) =>
  fetchApi<GeneratedLink>('/tracking-links/generate-meta', { method: 'POST', body: JSON.stringify(data) });

export const parseTrackingUrl = (url: string) =>
  fetchApi<Record<string, string | undefined>>('/tracking-links/parse', { method: 'POST', body: JSON.stringify({ url }) });

export const validateTrackingUrl = (url: string) =>
  fetchApi<{ valid: boolean; errors: string[] }>('/tracking-links/validate', { method: 'POST', body: JSON.stringify({ url }) });
