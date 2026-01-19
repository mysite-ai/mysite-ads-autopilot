import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService, AdSet, AdSetCategory, Restaurant, Event } from '../../services/supabase.service';
import { MetaApiService } from '../../services/meta-api.service';

interface TargetingTemplate {
  age_min?: number;
  age_max?: number;
  genders?: number[];
  interests?: Array<{ id: string; name: string }>;
}

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

  async getEvents(restaurantId?: string): Promise<Event[]> {
    return this.supabase.getEvents(restaurantId);
  }

  async getOrCreateAdSet(
    restaurant: Restaurant,
    categoryCode: string,
    eventIdentifier?: string,
  ): Promise<AdSet> {
    const existing = await this.supabase.getAdSetForCategory(
      restaurant.id,
      categoryCode,
      eventIdentifier,
    );

    if (existing) {
      this.logger.log(`Using existing ad set: ${existing.name}`);
      return existing;
    }

    return this.createAdSet(restaurant, categoryCode, eventIdentifier);
  }

  private async createAdSet(
    restaurant: Restaurant,
    categoryCode: string,
    eventIdentifier?: string,
  ): Promise<AdSet> {
    const category = await this.supabase.getAdSetCategory(categoryCode);
    if (!category) throw new Error(`Unknown category: ${categoryCode}`);
    if (!restaurant.meta_campaign_id) throw new Error(`No campaign for ${restaurant.name}`);

    const version = await this.supabase.getNextAdSetVersion(restaurant.id, category.id);
    const adSetName = `${restaurant.code}_${categoryCode}_${version.toString().padStart(2, '0')}`;

    // Pobierz szablon targetowania z kategorii
    const template = (category.targeting_template || {}) as TargetingTemplate;

    const radiusKm = category.requires_delivery
      ? restaurant.delivery_radius_km
      : this.getBaseRadiusKm(restaurant.area);

    // Buduj targeting z szablonu kategorii
    const targeting = this.metaApi.buildTargeting({
      lat: restaurant.location.lat,
      lng: restaurant.location.lng,
      radiusKm,
      includeInstagram: !!restaurant.instagram_account_id,
      // Parametry z szablonu kategorii
      ageMin: template.age_min,
      ageMax: template.age_max,
      genders: template.genders,
      interests: template.interests,
    });

    this.logger.log(`Creating ad set with targeting: age=${template.age_min || 18}-${template.age_max || 65}, genders=${template.genders?.join(',') || 'all'}, interests=${template.interests?.length || 0}`);

    const metaAdSetId = await this.metaApi.createAdSet({
      campaignId: restaurant.meta_campaign_id,
      name: adSetName,
      targeting,
      dailyBudget: 10, // 10 PLN min
      beneficiary: restaurant.name,
      pageId: restaurant.facebook_page_id,
    });

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

  async deleteAdSet(adSetId: string): Promise<{ success: boolean }> {
    const adSet = await this.supabase.getAdSet(adSetId);
    if (!adSet) {
      throw new Error(`Ad Set nie znaleziony: ${adSetId}`);
    }

    // Usuń ad set z Meta jeśli istnieje
    if (adSet.meta_ad_set_id) {
      try {
        await this.metaApi.deleteAdSet(adSet.meta_ad_set_id);
        this.logger.log(`Usunięto ad set z Meta: ${adSet.meta_ad_set_id}`);
      } catch (error) {
        this.logger.warn(`Nie udało się usunąć ad set z Meta: ${error}`);
      }
    }

    // Usuń wszystkie posty powiązane z tym ad setem
    await this.supabase.deletePostsByAdSetId(adSetId);
    
    // Usuń ad set z bazy
    await this.supabase.deleteAdSet(adSetId);
    this.logger.log(`Usunięto ad set ${adSetId}`);
    
    return { success: true };
  }
}
