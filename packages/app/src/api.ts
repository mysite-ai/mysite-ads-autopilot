import type { Restaurant, AdSetCategory, AdSet, Post, CreateRestaurantDto } from './types';

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

// Ad Sets
export const getAdSetCategories = () => fetchApi<AdSetCategory[]>('/ad-sets/categories');
export const updateAdSetCategory = (id: string, data: Partial<AdSetCategory>) =>
  fetchApi<AdSetCategory>(`/ad-sets/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const getAdSets = (restaurantId?: string) => 
  fetchApi<AdSet[]>(`/ad-sets${restaurantId ? `?restaurantId=${restaurantId}` : ''}`);

// Posts
export const getPosts = (restaurantId?: string) =>
  fetchApi<Post[]>(`/posts${restaurantId ? `?restaurantId=${restaurantId}` : ''}`);
export const pausePost = (id: string) =>
  fetchApi<Post>(`/posts/${id}/pause`, { method: 'POST' });
export const activatePost = (id: string) =>
  fetchApi<Post>(`/posts/${id}/activate`, { method: 'POST' });
export const addManualPost = (data: { restaurant_id: string; post_id: string; content: string }) =>
  fetchApi<Post>('/posts/manual', { method: 'POST', body: JSON.stringify(data) });

// Scheduler
export const triggerExpirePosts = () =>
  fetchApi<{ total: number; success: number; failed: number }>('/scheduler/expire-posts', { method: 'POST' });
