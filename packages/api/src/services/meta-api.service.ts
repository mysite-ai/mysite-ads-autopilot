import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const META_API_VERSION = 'v23.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

interface MetaApiResponse {
  id?: string;
  error?: { message: string; error_user_msg?: string };
}

/**
 * Naming conventions for Meta Ads:
 * - Campaign: {RID}-{slug}
 * - Ad Set: pk{PK}_{category_code}_v{version}
 * - Ad: pk{PK}_{meta_ad_id}
 */
@Injectable()
export class MetaApiService {
  private readonly logger = new Logger(MetaApiService.name);
  private accessToken: string;
  private adAccountId: string;
  private agencyName: string;

  constructor(private config: ConfigService) {
    this.accessToken = this.config.getOrThrow('META_ACCESS_TOKEN');
    this.adAccountId = this.config.getOrThrow('META_AD_ACCOUNT_ID');
    this.agencyName = this.config.get('AGENCY_NAME', 'JETLABS SP Z O O');
  }

  private async request<T extends MetaApiResponse>(
    url: string,
    method: 'GET' | 'POST' = 'POST',
    body?: Record<string, unknown>,
  ): Promise<T> {
    const fullUrl = `${url}${url.includes('?') ? '&' : '?'}access_token=${this.accessToken}`;
    
    const options: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    this.logger.debug(`Meta API ${method} ${url}`);
    if (body) this.logger.debug(`Body: ${JSON.stringify(body)}`);
    
    const response = await fetch(fullUrl, options);
    const data = await response.json() as T;

    if (data.error) {
      this.logger.error(`Meta API Error: ${JSON.stringify(data.error)}`);
      throw new Error(`Meta API Error: ${data.error.message} ${data.error.error_user_msg || ''}`);
    }
    return data;
  }

  // =============================================
  // NAMING HELPERS
  // =============================================
  
  /**
   * Generate campaign name: {RID}-{slug}
   */
  generateCampaignName(rid: number, slug: string): string {
    return `${rid}-${slug}`;
  }

  /**
   * Generate ad set name: pk{PK}_{category_code}_v{version}
   */
  generateAdSetName(pk: number, categoryCode: string, version: number): string {
    return `pk${pk}_${categoryCode}_v${version}`;
  }

  /**
   * Generate ad name: pk{PK}_{meta_ad_id}
   * Note: meta_ad_id is added after creation, so initial name uses placeholder
   */
  generateAdName(pk: number, adId?: string): string {
    return `pk${pk}_${adId || 'pending'}`;
  }

  // =============================================
  // CAMPAIGN OPERATIONS
  // =============================================
  
  /**
   * Create campaign with new naming convention: {RID}-{slug}
   * TRAFFIC objective - visits to FB/IG profile (no pixel required)
   */
  async createCampaign(rid: number, slug: string): Promise<string> {
    const campaignName = this.generateCampaignName(rid, slug);
    const url = `${META_API_BASE}/act_${this.adAccountId}/campaigns`;
    const result = await this.request<MetaApiResponse>(url, 'POST', {
      name: campaignName,
      objective: 'OUTCOME_TRAFFIC',
      status: 'PAUSED',
      special_ad_categories: [],
      is_adset_budget_sharing_enabled: false,
    });
    
    if (!result.id) throw new Error('Failed to create campaign');
    this.logger.log(`Created campaign: ${result.id} (name: ${campaignName})`);
    return result.id;
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use createCampaign(rid, slug) instead
   */
  async createCampaignLegacy(restaurantName: string): Promise<string> {
    const url = `${META_API_BASE}/act_${this.adAccountId}/campaigns`;
    const result = await this.request<MetaApiResponse>(url, 'POST', {
      name: restaurantName,
      objective: 'OUTCOME_TRAFFIC',
      status: 'PAUSED',
      special_ad_categories: [],
      is_adset_budget_sharing_enabled: false,
    });
    
    if (!result.id) throw new Error('Failed to create campaign');
    this.logger.log(`Created campaign (legacy): ${result.id}`);
    return result.id;
  }

  // =============================================
  // AD SET OPERATIONS
  // =============================================
  
  /**
   * Create Ad Set with new naming convention: pk{PK}_{category_code}_v{version}
   * LINK_CLICKS objective (no pixel required)
   */
  async createAdSet(params: {
    campaignId: string;
    pk: number;
    categoryCode: string;
    version: number;
    targeting: Record<string, unknown>;
    dailyBudget: number;
    beneficiary: string;
    pageId: string;
  }): Promise<string> {
    const adSetName = this.generateAdSetName(params.pk, params.categoryCode, params.version);
    const url = `${META_API_BASE}/act_${this.adAccountId}/adsets`;
    
    const result = await this.request<MetaApiResponse>(url, 'POST', {
      campaign_id: params.campaignId,
      name: adSetName,
      status: 'ACTIVE',
      daily_budget: params.dailyBudget * 100, // grosze
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: params.targeting,
      dsa_beneficiary: params.beneficiary,
      dsa_payor: this.agencyName,
    });

    if (!result.id) throw new Error('Failed to create ad set');
    this.logger.log(`Created ad set: ${result.id} (name: ${adSetName})`);
    return result.id;
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use createAdSet with pk, categoryCode, version instead
   */
  async createAdSetLegacy(params: {
    campaignId: string;
    name: string;
    targeting: Record<string, unknown>;
    dailyBudget: number;
    beneficiary: string;
    pageId: string;
  }): Promise<string> {
    const url = `${META_API_BASE}/act_${this.adAccountId}/adsets`;
    
    const result = await this.request<MetaApiResponse>(url, 'POST', {
      campaign_id: params.campaignId,
      name: params.name,
      status: 'ACTIVE',
      daily_budget: params.dailyBudget * 100,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: params.targeting,
      dsa_beneficiary: params.beneficiary,
      dsa_payor: this.agencyName,
    });

    if (!result.id) throw new Error('Failed to create ad set');
    this.logger.log(`Created ad set (legacy): ${result.id}`);
    return result.id;
  }

  async createCreative(params: { 
    pageId: string; 
    postId: string;
    websiteUrl?: string;
  }): Promise<string> {
    const url = `${META_API_BASE}/act_${this.adAccountId}/adcreatives`;
    
    const body: Record<string, unknown> = {
      name: `Creative - ${params.postId}`,
      object_story_id: `${params.pageId}_${params.postId}`,
    };

    // Dodaj Call to Action z linkiem do strony jeśli podano
    if (params.websiteUrl) {
      body.call_to_action = {
        type: 'LEARN_MORE',
        value: {
          link: params.websiteUrl,
        },
      };
      // Source URL dla trackingu
      body.source_url = params.websiteUrl;
    }

    const result = await this.request<MetaApiResponse>(url, 'POST', body);

    if (!result.id) throw new Error('Failed to create creative');
    this.logger.log(`Created creative with CTA link: ${params.websiteUrl || 'none'}`);
    return result.id;
  }

  // =============================================
  // AD OPERATIONS
  // =============================================
  
  /**
   * Create Ad with new naming convention: pk{PK}_{meta_ad_id}
   * Includes URL parameters for tracking (r, c, utm_*)
   * The {{ad.id}} macro in URL params will be replaced by Meta with actual ad ID
   */
  async createAd(params: { 
    adSetId: string; 
    creativeId: string; 
    pk: number;
    urlParams?: string;  // URL parameters string: r=1&c=.pi1.pk2.ps{{ad.id}}&utm_source=...
  }): Promise<string> {
    const url = `${META_API_BASE}/act_${this.adAccountId}/ads`;
    
    // Create with temporary name first
    const tempName = this.generateAdName(params.pk, 'temp');
    
    const body: Record<string, unknown> = {
      name: tempName,
      adset_id: params.adSetId,
      creative: { creative_id: params.creativeId },
      status: 'ACTIVE',
    };

    // Add URL parameters for tracking if provided
    // url_tags will be appended to all outbound URLs in the ad
    if (params.urlParams) {
      body.url_tags = params.urlParams;
      this.logger.log(`Ad URL params: ${params.urlParams}`);
    }

    const result = await this.request<MetaApiResponse>(url, 'POST', body);

    if (!result.id) throw new Error('Failed to create ad');
    
    // Update with the actual ad_id in the name
    const finalName = this.generateAdName(params.pk, result.id);
    await this.request(`${META_API_BASE}/${result.id}`, 'POST', { name: finalName });
    
    this.logger.log(`Created ad: ${result.id} (name: ${finalName})`);
    return result.id;
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use createAd with pk instead
   */
  async createAdLegacy(params: { adSetId: string; creativeId: string; name: string }): Promise<string> {
    const url = `${META_API_BASE}/act_${this.adAccountId}/ads`;
    const result = await this.request<MetaApiResponse>(url, 'POST', {
      name: params.name,
      adset_id: params.adSetId,
      creative: { creative_id: params.creativeId },
      status: 'ACTIVE',
    });

    if (!result.id) throw new Error('Failed to create ad');
    this.logger.log(`Created ad (legacy): ${result.id}`);
    return result.id;
  }

  async updateAdStatus(adId: string, status: 'ACTIVE' | 'PAUSED'): Promise<void> {
    await this.request(`${META_API_BASE}/${adId}`, 'POST', { status });
  }

  async deleteAdSet(adSetId: string): Promise<void> {
    await this.request(`${META_API_BASE}/${adSetId}`, 'POST', { status: 'DELETED' });
    this.logger.log(`Deleted ad set: ${adSetId}`);
  }

  async deleteAd(adId: string): Promise<void> {
    await this.request(`${META_API_BASE}/${adId}`, 'POST', { status: 'DELETED' });
    this.logger.log(`Deleted ad: ${adId}`);
  }

  buildTargeting(params: {
    lat: number;
    lng: number;
    radiusKm: number;
    ageMin?: number;
    ageMax?: number;
    genders?: number[];
    interests?: Array<{ id: string; name: string }>;
    includeInstagram?: boolean;
  }): Record<string, unknown> {
    // Validate location - Meta requires a real location
    if (!params.lat || !params.lng || (params.lat === 0 && params.lng === 0)) {
      throw new Error('Invalid restaurant location. Please set a valid latitude and longitude before creating ads.');
    }

    const targeting: Record<string, unknown> = {
      geo_locations: {
        custom_locations: [{
          latitude: params.lat,
          longitude: params.lng,
          radius: params.radiusKm,
          distance_unit: 'kilometer',
        }],
      },
      age_min: params.ageMin || 18,
      age_max: params.ageMax || 65,
      facebook_positions: ['feed'],
    };

    // Płeć (1 = mężczyźni, 2 = kobiety, puste = wszyscy)
    if (params.genders && params.genders.length > 0) {
      targeting.genders = params.genders;
    }

    // Zainteresowania
    if (params.interests && params.interests.length > 0) {
      targeting.flexible_spec = [{
        interests: params.interests.map(i => ({ id: i.id, name: i.name })),
      }];
    }

    // Platformy
    if (params.includeInstagram !== false) {
      targeting.publisher_platforms = ['facebook', 'instagram'];
      targeting.instagram_positions = ['stream', 'story', 'reels'];
    } else {
      targeting.publisher_platforms = ['facebook'];
    }

    return targeting;
  }
}
