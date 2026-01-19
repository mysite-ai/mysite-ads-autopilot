import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService, Restaurant } from '../../services/supabase.service';
import { MetaApiService } from '../../services/meta-api.service';

export interface CreateRestaurantDto {
  name: string;
  code: string;
  website: string;
  area: 'S-CITY' | 'M-CITY' | 'L-CITY';
  fame: 'Neutral' | 'Hot' | 'Epic';
  delivery_radius_km: number;
  budget_priorities: Record<string, number>;
  facebook_page_id: string;
  instagram_account_id: string;
  location: { lat: number; lng: number; address: string };
  meta_campaign_id?: string | null;
}

@Injectable()
export class RestaurantsService {
  private readonly logger = new Logger(RestaurantsService.name);

  constructor(
    private supabase: SupabaseService,
    private metaApi: MetaApiService,
  ) {}

  async getAll(): Promise<Restaurant[]> {
    return this.supabase.getRestaurants();
  }

  async getOne(id: string): Promise<Restaurant | null> {
    return this.supabase.getRestaurant(id);
  }

  async create(dto: CreateRestaurantDto): Promise<Restaurant> {
    const restaurant = await this.supabase.createRestaurant({
      ...dto,
      meta_campaign_id: dto.meta_campaign_id || null,
    });

    if (!dto.meta_campaign_id) {
      try {
        const campaignId = await this.metaApi.createCampaign(dto.name);
        this.logger.log(`Created campaign ${campaignId} for ${dto.name}`);
        return this.supabase.updateRestaurant(restaurant.id, { meta_campaign_id: campaignId });
      } catch (error) {
        this.logger.error(`Failed to create campaign: ${error}`);
        return restaurant;
      }
    }

    return restaurant;
  }

  async update(id: string, dto: Partial<CreateRestaurantDto>): Promise<Restaurant> {
    return this.supabase.updateRestaurant(id, dto);
  }

  async delete(id: string): Promise<{ success: boolean }> {
    await this.supabase.deleteRestaurant(id);
    return { success: true };
  }

  async retryCampaign(id: string): Promise<Restaurant> {
    const restaurant = await this.supabase.getRestaurant(id);
    if (!restaurant) throw new Error(`Restaurant not found: ${id}`);
    if (restaurant.meta_campaign_id) return restaurant;

    const campaignId = await this.metaApi.createCampaign(restaurant.name);
    return this.supabase.updateRestaurant(id, { meta_campaign_id: campaignId });
  }
}
