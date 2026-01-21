import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService, AdSet, AdSetCategory, Restaurant, Event, Opportunity } from '../../services/supabase.service';
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

  // =============================================
  // NEW: Ad Set with Opportunity (PK) support
  // =============================================

  /**
   * Get or create an ad set for a given opportunity (PK) and category
   * Uses new naming convention: pk{PK}_{category_code}_v{version}
   */
  async getOrCreateAdSetWithPk(
    restaurant: Restaurant,
    opportunity: Opportunity,
    categoryCode: string,
    eventIdentifier?: string,
  ): Promise<AdSet> {
    // First try to find existing ad set with this PK and category
    const existing = await this.supabase.getAdSetForCategoryAndPk(
      restaurant.id,
      categoryCode,
      opportunity.pk,
      eventIdentifier,
    );

    if (existing) {
      this.logger.log(`Using existing ad set: ${existing.name} (pk=${opportunity.pk})`);
      return existing;
    }

    return this.createAdSetWithPk(restaurant, opportunity, categoryCode, eventIdentifier);
  }

  /**
   * Create a new ad set with PK-based naming
   */
  private async createAdSetWithPk(
    restaurant: Restaurant,
    opportunity: Opportunity,
    categoryCode: string,
    eventIdentifier?: string,
  ): Promise<AdSet> {
    const category = await this.supabase.getAdSetCategory(categoryCode);
    if (!category) throw new Error(`Unknown category: ${categoryCode}`);
    if (!restaurant.meta_campaign_id) throw new Error(`No campaign for ${restaurant.name}`);

    // Get next version for this specific PK + category combination
    const version = await this.supabase.getNextAdSetVersionForPk(restaurant.id, category.id, opportunity.pk);
    
    // Generate name: pk{PK}_{category_code}_v{version}
    const adSetName = this.metaApi.generateAdSetName(opportunity.pk, categoryCode, version);

    // Get targeting template from category
    const template = (category.targeting_template || {}) as TargetingTemplate;

    const radiusKm = category.requires_delivery
      ? restaurant.delivery_radius_km
      : this.getBaseRadiusKm(restaurant.area);

    // Build targeting from category template
    const targeting = this.metaApi.buildTargeting({
      lat: restaurant.location.lat,
      lng: restaurant.location.lng,
      radiusKm,
      includeInstagram: !!restaurant.instagram_account_id,
      ageMin: template.age_min,
      ageMax: template.age_max,
      genders: template.genders,
      interests: template.interests,
    });

    this.logger.log(`Creating ad set pk${opportunity.pk}_${categoryCode}_v${version} with targeting: age=${template.age_min || 18}-${template.age_max || 65}`);

    // Create ad set in Meta with new naming convention
    const metaAdSetId = await this.metaApi.createAdSet({
      campaignId: restaurant.meta_campaign_id,
      pk: opportunity.pk,
      categoryCode,
      version,
      targeting,
      dailyBudget: 10, // 10 PLN min
      beneficiary: restaurant.name,
      pageId: restaurant.facebook_page_id,
    });

    // Save to database with opportunity reference
    const adSet = await this.supabase.createAdSet({
      restaurant_id: restaurant.id,
      category_id: category.id,
      opportunity_id: opportunity.id,
      pk: opportunity.pk,
      meta_ad_set_id: metaAdSetId,
      name: adSetName,
      version,
      ads_count: 0,
      status: 'ACTIVE',
      event_identifier: eventIdentifier || null,
    });

    this.logger.log(`Created ad set: ${adSetName} (meta_id: ${metaAdSetId})`);
    return adSet;
  }

  // =============================================
  // LEGACY: Ad Set without PK (for backward compatibility)
  // =============================================

  /**
   * @deprecated Use getOrCreateAdSetWithPk instead
   */
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

    return this.createAdSetLegacy(restaurant, categoryCode, eventIdentifier);
  }

  /**
   * @deprecated Legacy ad set creation without PK
   */
  private async createAdSetLegacy(
    restaurant: Restaurant,
    categoryCode: string,
    eventIdentifier?: string,
  ): Promise<AdSet> {
    const category = await this.supabase.getAdSetCategory(categoryCode);
    if (!category) throw new Error(`Unknown category: ${categoryCode}`);
    if (!restaurant.meta_campaign_id) throw new Error(`No campaign for ${restaurant.name}`);

    const version = await this.supabase.getNextAdSetVersion(restaurant.id, category.id);
    const adSetName = `${restaurant.slug}_${categoryCode}_v${version}`;

    const template = (category.targeting_template || {}) as TargetingTemplate;

    const radiusKm = category.requires_delivery
      ? restaurant.delivery_radius_km
      : this.getBaseRadiusKm(restaurant.area);

    const targeting = this.metaApi.buildTargeting({
      lat: restaurant.location.lat,
      lng: restaurant.location.lng,
      radiusKm,
      includeInstagram: !!restaurant.instagram_account_id,
      ageMin: template.age_min,
      ageMax: template.age_max,
      genders: template.genders,
      interests: template.interests,
    });

    this.logger.log(`Creating ad set (legacy): ${adSetName}`);

    const metaAdSetId = await this.metaApi.createAdSetLegacy({
      campaignId: restaurant.meta_campaign_id,
      name: adSetName,
      targeting,
      dailyBudget: 10,
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

    this.logger.log(`Created ad set (legacy): ${adSetName}`);
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
