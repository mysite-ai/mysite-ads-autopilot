import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService, TrackingLink, Platform } from './supabase.service';

export interface TrackingLinkParams {
  rid: number;                    // Restaurant ID
  pi: number;                     // Platform ID (1=Meta)
  pk: number;                     // Opportunity Key
  ps: string;                     // Placement/Single Unit ID ({{ad.id}} for Meta)
  destinationUrl: string;         // Target URL
  opportunitySlug: string;        // Slug for utm_campaign
  categoryCode: string;           // Category code for utm_content
  version: number;                // Ad set version
}

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
}

// Platform ID to utm_medium mapping
const PLATFORM_MEDIUM: Record<number, string> = {
  1: 'meta',
  2: 'google',
  3: 'email',
  4: 'influencer',
  5: 'marketplace',
};

@Injectable()
export class TrackingLinkService {
  private readonly logger = new Logger(TrackingLinkService.name);

  constructor(private supabase: SupabaseService) {}

  /**
   * Generate a tracking link with all required UTM and custom parameters
   * 
   * URL format:
   * {destinationUrl}?r={rid}&c=.pi{PI}.pk{PK}.ps{PS}&utm_source=mysite&utm_medium={platform}&utm_campaign=pk{PK}-{slug}&utm_content={category}-v{version}
   */
  generateTrackingLink(params: TrackingLinkParams): GeneratedLink {
    const {
      rid, pi, pk, ps, destinationUrl,
      opportunitySlug, categoryCode, version
    } = params;

    // Build components (no padding - RID and PK are regular integers)
    const components = {
      r: String(rid),
      c: `.pi${pi}.pk${pk}.ps${ps}`,
      utm_source: 'mysite',
      utm_medium: PLATFORM_MEDIUM[pi] || 'unknown',
      utm_campaign: `pk${pk}-${opportunitySlug}`,
      utm_content: `${categoryCode}-v${version}`,
    };

    // Build URL
    const url = new URL(destinationUrl);
    url.searchParams.set('r', components.r);
    url.searchParams.set('c', components.c);
    url.searchParams.set('utm_source', components.utm_source);
    url.searchParams.set('utm_medium', components.utm_medium);
    url.searchParams.set('utm_campaign', components.utm_campaign);
    url.searchParams.set('utm_content', components.utm_content);

    return {
      finalUrl: url.toString(),
      components,
    };
  }

  /**
   * Generate tracking link for Meta Ads with {{ad.id}} macro
   * The {{ad.id}} macro will be replaced by Meta with the actual ad ID at runtime
   */
  generateMetaTrackingLink(params: Omit<TrackingLinkParams, 'pi' | 'ps'>): GeneratedLink {
    return this.generateTrackingLink({
      ...params,
      pi: 1,  // Meta Ads = PI 1
      ps: '{{ad.id}}',  // Meta macro
    });
  }

  /**
   * Generate and save a tracking link to the database
   */
  async createAndSaveTrackingLink(
    params: TrackingLinkParams,
    postId?: string,
  ): Promise<TrackingLink> {
    const generated = this.generateTrackingLink(params);

    const link = await this.supabase.createTrackingLink({
      rid: params.rid,
      pi: params.pi,
      pk: params.pk,
      post_id: postId || null,
      destination_url: params.destinationUrl,
      final_url: generated.finalUrl,
      c_param: generated.components.c,
      utm_source: generated.components.utm_source,
      utm_medium: generated.components.utm_medium,
      utm_campaign: generated.components.utm_campaign,
      utm_content: generated.components.utm_content,
    });

    this.logger.log(`Created tracking link: pk=${params.pk}, url=${generated.finalUrl}`);
    return link;
  }

  /**
   * Get all tracking links, optionally filtered by rid and/or pk
   */
  async getTrackingLinks(rid?: number, pk?: number): Promise<TrackingLink[]> {
    return this.supabase.getTrackingLinks(rid, pk);
  }

  /**
   * Get all available platforms
   */
  async getPlatforms(): Promise<Platform[]> {
    return this.supabase.getPlatforms();
  }

  /**
   * Parse a tracking URL to extract parameters
   * Useful for debugging and validation
   */
  parseTrackingUrl(url: string): {
    rid?: string;
    pi?: string;
    pk?: string;
    ps?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
  } | null {
    try {
      const parsedUrl = new URL(url);
      const r = parsedUrl.searchParams.get('r');
      const c = parsedUrl.searchParams.get('c');

      // Parse c parameter: .pi{PI}.pk{PK}.ps{PS}
      let pi: string | undefined;
      let pk: string | undefined;
      let ps: string | undefined;

      if (c) {
        const piMatch = c.match(/\.pi(\d+)/);
        const pkMatch = c.match(/\.pk(\d+)/);
        const psMatch = c.match(/\.ps([^.]+)/);

        pi = piMatch?.[1];
        pk = pkMatch?.[1];
        ps = psMatch?.[1];
      }

      return {
        rid: r || undefined,
        pi,
        pk,
        ps,
        utm_source: parsedUrl.searchParams.get('utm_source') || undefined,
        utm_medium: parsedUrl.searchParams.get('utm_medium') || undefined,
        utm_campaign: parsedUrl.searchParams.get('utm_campaign') || undefined,
        utm_content: parsedUrl.searchParams.get('utm_content') || undefined,
      };
    } catch {
      this.logger.warn(`Failed to parse URL: ${url}`);
      return null;
    }
  }

  /**
   * Validate that a tracking URL has all required parameters
   */
  validateTrackingUrl(url: string): { valid: boolean; errors: string[] } {
    const parsed = this.parseTrackingUrl(url);
    const errors: string[] = [];

    if (!parsed) {
      return { valid: false, errors: ['Invalid URL format'] };
    }

    if (!parsed.rid) errors.push('Missing r (restaurant ID) parameter');
    if (!parsed.pi) errors.push('Missing pi (platform ID) in c parameter');
    if (!parsed.pk) errors.push('Missing pk (opportunity key) in c parameter');
    if (!parsed.ps) errors.push('Missing ps (ad ID) in c parameter');
    if (!parsed.utm_source) errors.push('Missing utm_source parameter');
    if (!parsed.utm_medium) errors.push('Missing utm_medium parameter');
    if (!parsed.utm_campaign) errors.push('Missing utm_campaign parameter');

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
