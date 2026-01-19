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
    let campaignId = dto.meta_campaign_id || null;

    // If no campaign ID provided, try to create one in Meta Ads
    if (!campaignId) {
      campaignId = await this.metaApi.createCampaign(dto.name);
      if (campaignId) {
        this.logger.log(`Created Meta campaign ${campaignId} for ${dto.name}`);
      } else {
        this.logger.warn(`Skipping Meta campaign creation for ${dto.name} - will need to be created manually`);
      }
    } else {
      this.logger.log(`Using provided campaign ID ${campaignId} for ${dto.name}`);
    }

    // Save restaurant with or without campaign ID
    return this.supabase.createRestaurant({
      ...dto,
      meta_campaign_id: campaignId,
    });
  }

  async update(id: string, dto: Partial<CreateRestaurantDto>): Promise<Restaurant> {
    return this.supabase.updateRestaurant(id, dto);
  }
}
