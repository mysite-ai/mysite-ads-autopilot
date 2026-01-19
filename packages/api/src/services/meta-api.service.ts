import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const META_API_VERSION = 'v23.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

interface MetaApiResponse {
  id?: string;
  error?: { message: string; error_user_msg?: string };
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

  // Kampania TRAFFIC - cel: wizyty na profilu FB/IG (nie wymaga pixela!)
  async createCampaign(restaurantName: string): Promise<string> {
    const url = `${META_API_BASE}/act_${this.adAccountId}/campaigns`;
    const result = await this.request<MetaApiResponse>(url, 'POST', {
      name: restaurantName,
      objective: 'OUTCOME_TRAFFIC',
      status: 'PAUSED',
      special_ad_categories: [],
      is_adset_budget_sharing_enabled: false,
    });
    
    if (!result.id) throw new Error('Failed to create campaign');
    this.logger.log(`Created campaign: ${result.id}`);
    return result.id;
  }

  // Ad Set z celem LINK_CLICKS (nie wymaga pixela!)
  async createAdSet(params: {
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
      daily_budget: params.dailyBudget * 100, // grosze
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: params.targeting,
      dsa_beneficiary: params.beneficiary,
      dsa_payor: this.agencyName,
    });

    if (!result.id) throw new Error('Failed to create ad set');
    this.logger.log(`Created ad set: ${result.id}`);
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

  async createAd(params: { adSetId: string; creativeId: string; name: string }): Promise<string> {
    const url = `${META_API_BASE}/act_${this.adAccountId}/ads`;
    const result = await this.request<MetaApiResponse>(url, 'POST', {
      name: params.name,
      adset_id: params.adSetId,
      creative: { creative_id: params.creativeId },
      status: 'ACTIVE',
    });

    if (!result.id) throw new Error('Failed to create ad');
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
