import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const META_API_VERSION = 'v23.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

interface MetaApiError {
  message: string;
  type: string;
  code: number;
}

interface MetaApiResponse {
  id?: string;
  error?: MetaApiError;
  data?: unknown[];
}

interface AudienceEstimate {
  users_lower_bound: number;
  users_upper_bound: number;
}

@Injectable()
export class MetaApiService {
  private readonly logger = new Logger(MetaApiService.name);
  private accessToken: string;
  private adAccountId: string;
  private agencyName: string;

  constructor(private config: ConfigService) {
    this.accessToken = this.config.getOrThrow('META_ACCESS_TOKEN');
    this.adAccountId = this.config.getOrThrow('META_AD_ACCOUNT_ID');
    this.agencyName = this.config.get('AGENCY_NAME', 'MarketingAgency');
  }

  private async request<T extends MetaApiResponse>(
    url: string,
    method: 'GET' | 'POST' = 'POST',
    body?: Record<string, unknown>,
  ): Promise<T> {
    const fullUrl = `${url}${url.includes('?') ? '&' : '?'}access_token=${this.accessToken}`;
    
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    
    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    this.logger.debug(`Meta API ${method} ${url}`);
    const response = await fetch(fullUrl, options);
    const data = await response.json() as T;

    if (data.error) {
      this.logger.error(`Meta API Error: ${data.error.message}`);
      throw new Error(`Meta API Error: ${data.error.message}`);
    }

    return data;
  }

  async createCampaign(restaurantName: string): Promise<string | null> {
    try {
      const url = `${META_API_BASE}/act_${this.adAccountId}/campaigns`;
      const result = await this.request<MetaApiResponse>(url, 'POST', {
        name: restaurantName,
        objective: 'OUTCOME_TRAFFIC',
        status: 'PAUSED',
        special_ad_categories: [],
      });
      
      if (!result.id) throw new Error('Failed to create campaign');
      this.logger.log(`Created campaign: ${result.id} for ${restaurantName}`);
      return result.id;
    } catch (error) {
      this.logger.error(`Failed to create campaign for ${restaurantName}: ${error}`);
      return null;
    }
  }

  async createAdSet(params: {
    campaignId: string;
    name: string;
    targeting: Record<string, unknown>;
    dailyBudget: number;
  }): Promise<string> {
    const url = `${META_API_BASE}/act_${this.adAccountId}/adsets`;
    const result = await this.request<MetaApiResponse>(url, 'POST', {
      campaign_id: params.campaignId,
      name: params.name,
      status: 'ACTIVE',
      daily_budget: params.dailyBudget * 100, // Convert to cents
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'POST_ENGAGEMENT',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: params.targeting,
    });

    if (!result.id) throw new Error('Failed to create ad set');
    this.logger.log(`Created ad set: ${result.id} - ${params.name}`);
    return result.id;
  }

  async createCreative(params: {
    pageId: string;
    postId: string;
    restaurantName: string;
  }): Promise<string> {
    const url = `${META_API_BASE}/act_${this.adAccountId}/adcreatives`;
    const objectStoryId = `${params.pageId}_${params.postId}`;
    
    const result = await this.request<MetaApiResponse>(url, 'POST', {
      name: `Creative - ${params.postId}`,
      object_story_id: objectStoryId,
      degrees_of_freedom_spec: {
        creative_features_spec: {
          standard_enhancements: {
            enroll_status: 'OPT_OUT',
          },
        },
      },
      contextual_multi_ads: {
        enroll_status: 'OPT_OUT',
      },
      // Beneficiary and Payer for EU transparency
      object_story_spec: {
        page_id: params.pageId,
      },
    });

    if (!result.id) throw new Error('Failed to create creative');
    this.logger.log(`Created creative: ${result.id}`);
    return result.id;
  }

  async createAd(params: {
    adSetId: string;
    creativeId: string;
    name: string;
  }): Promise<string> {
    const url = `${META_API_BASE}/act_${this.adAccountId}/ads`;
    const result = await this.request<MetaApiResponse>(url, 'POST', {
      name: params.name,
      adset_id: params.adSetId,
      creative: { creative_id: params.creativeId },
      status: 'ACTIVE',
    });

    if (!result.id) throw new Error('Failed to create ad');
    this.logger.log(`Created ad: ${result.id} - ${params.name}`);
    return result.id;
  }

  async updateAdStatus(adId: string, status: 'ACTIVE' | 'PAUSED'): Promise<void> {
    const url = `${META_API_BASE}/${adId}`;
    await this.request<MetaApiResponse>(url, 'POST', { status });
    this.logger.log(`Updated ad ${adId} status to ${status}`);
  }

  async updateAdSetStatus(adSetId: string, status: 'ACTIVE' | 'PAUSED'): Promise<void> {
    const url = `${META_API_BASE}/${adSetId}`;
    await this.request<MetaApiResponse>(url, 'POST', { status });
    this.logger.log(`Updated ad set ${adSetId} status to ${status}`);
  }

  async getAudienceEstimate(targeting: Record<string, unknown>): Promise<AudienceEstimate | null> {
    try {
      const url = `${META_API_BASE}/act_${this.adAccountId}/reachestimate`;
      const result = await this.request<MetaApiResponse & { data?: AudienceEstimate[] }>(url, 'GET');
      return result.data?.[0] || null;
    } catch {
      this.logger.warn('Failed to get audience estimate');
      return null;
    }
  }

  buildTargeting(params: {
    lat: number;
    lng: number;
    radiusKm: number;
    ageMin?: number;
    ageMax?: number;
    interests?: Array<{ id: string; name: string }>;
  }): Record<string, unknown> {
    const targeting: Record<string, unknown> = {
      geo_locations: {
        custom_locations: [
          {
            latitude: params.lat,
            longitude: params.lng,
            radius: params.radiusKm,
            distance_unit: 'kilometer',
          },
        ],
      },
      age_min: params.ageMin || 18,
      age_max: params.ageMax || 65,
      publisher_platforms: ['facebook', 'instagram'],
      facebook_positions: ['feed', 'story', 'reels'],
      instagram_positions: ['stream', 'story', 'reels'],
    };

    if (params.interests?.length) {
      targeting.flexible_spec = [{ interests: params.interests }];
    }

    return targeting;
  }
}
