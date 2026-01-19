import { Injectable, Logger } from '@nestjs/common';
import {
  SupabaseService,
  AdSet,
  AdSetCategory,
  Restaurant,
} from '../../services/supabase.service';
import { MetaApiService } from '../../services/meta-api.service';

// Category-specific targeting overrides
const CATEGORY_TARGETING: Record<string, Partial<{
  ageMin: number;
  ageMax: number;
  interests: Array<{ id: string; name: string }>;
}>> = {
  EV_FAM: {
    interests: [{ id: '6003139266461', name: 'Family' }],
  },
  EV_PAR: {
    ageMin: 21,
    ageMax: 45,
    interests: [{ id: '6003248649975', name: 'Dating' }],
  },
  EV_SEN: {
    ageMin: 55,
    ageMax: 65,
  },
  LU_ONS: {
    interests: [{ id: '6003107902433', name: 'Restaurants' }],
  },
  LU_DEL: {
    interests: [{ id: '6003384829661', name: 'Food delivery' }],
  },
  PD_DEL: {
    interests: [{ id: '6003384829661', name: 'Food delivery' }],
  },
  PR_DEL_CYK: {
    interests: [{ id: '6003384829661', name: 'Food delivery' }],
  },
  PR_DEL_JED: {
    interests: [{ id: '6003384829661', name: 'Food delivery' }],
  },
};

@Injectable()
export class AdSetsService {
  private readonly logger = new Logger(AdSetsService.name);

  constructor(
    private supabase: SupabaseService,
    private metaApi: MetaApiService,
  ) {}

  async getCategories(): Promise<AdSetCategory[]> {
    return this.supabase.getAdSetCategories();
  }

  async updateCategory(id: string, updates: Partial<AdSetCategory>): Promise<AdSetCategory> {
    return this.supabase.updateAdSetCategory(id, updates);
  }

  async getAdSets(restaurantId?: string): Promise<AdSet[]> {
    return this.supabase.getAdSets(restaurantId);
  }

  async getOrCreateAdSet(
    restaurant: Restaurant,
    categoryCode: string,
    eventIdentifier?: string,
  ): Promise<AdSet> {
    // Check for existing ad set with available capacity
    const existing = await this.supabase.getAdSetForCategory(
      restaurant.id,
      categoryCode,
      eventIdentifier,
    );

    if (existing) {
      this.logger.log(`Using existing ad set: ${existing.name}`);
      return existing;
    }

    // Need to create new ad set
    return this.createAdSet(restaurant, categoryCode, eventIdentifier);
  }

  private async createAdSet(
    restaurant: Restaurant,
    categoryCode: string,
    eventIdentifier?: string,
  ): Promise<AdSet> {
    const category = await this.supabase.getAdSetCategory(categoryCode);
    if (!category) {
      throw new Error(`Unknown category: ${categoryCode}`);
    }

    if (!restaurant.meta_campaign_id) {
      throw new Error(`Restaurant ${restaurant.name} has no campaign`);
    }

    // Get next version number
    const version = await this.supabase.getNextAdSetVersion(restaurant.id, category.id);
    const versionStr = version.toString().padStart(2, '0');
    const adSetName = `${restaurant.code}_${categoryCode}_${versionStr}`;

    // Build targeting
    const isDelivery = category.requires_delivery;
    const radiusKm = isDelivery
      ? restaurant.delivery_radius_km
      : this.getBaseRadiusKm(restaurant.area);

    const categoryOverrides = CATEGORY_TARGETING[categoryCode] || {};
    const targeting = this.metaApi.buildTargeting({
      lat: restaurant.location.lat,
      lng: restaurant.location.lng,
      radiusKm,
      ageMin: categoryOverrides.ageMin,
      ageMax: categoryOverrides.ageMax,
      interests: categoryOverrides.interests,
    });

    // Calculate daily budget based on priorities
    const baseBudget = 50; // PLN - could be made configurable
    const categoryPriority = restaurant.budget_priorities[category.parent_category] || 10;
    const totalPriority = Object.values(restaurant.budget_priorities).reduce((a, b) => a + b, 100);
    const dailyBudget = Math.round((baseBudget * categoryPriority) / totalPriority);

    // Create in Meta
    const metaAdSetId = await this.metaApi.createAdSet({
      campaignId: restaurant.meta_campaign_id,
      name: adSetName,
      targeting,
      dailyBudget: Math.max(dailyBudget, 5), // Min 5 PLN
    });

    // Save to database
    const adSet = await this.supabase.createAdSet({
      restaurant_id: restaurant.id,
      category_id: category.id,
      meta_ad_set_id: metaAdSetId,
      name: adSetName,
      version,
      ads_count: 0,
      status: 'ACTIVE',
      event_identifier: eventIdentifier || null,
    });

    this.logger.log(`Created ad set: ${adSetName}`);
    return adSet;
  }

  private getBaseRadiusKm(area: string): number {
    switch (area) {
      case 'S-CITY': return 5;
      case 'M-CITY': return 10;
      case 'L-CITY': return 15;
      default: return 10;
    }
  }
}
