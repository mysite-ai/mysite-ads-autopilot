import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../services/supabase.service';
import { PostsService } from '../posts/posts.service';

// Ayrshare webhook payload structure
interface AyrshareWebhookPayload {
  post?: {
    id?: string;
    postIds?: Array<{
      platform: string;
      postId: string;
      postUrl?: string;
    }>;
    post?: string;
    mediaUrls?: string[];
  };
  status?: string;
  profile?: string;
  refId?: string;
  [key: string]: unknown;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private webhookSecret: string;

  constructor(
    private config: ConfigService,
    private supabase: SupabaseService,
    private posts: PostsService,
  ) {
    this.webhookSecret = this.config.get('WEBHOOK_SECRET', '');
  }

  validateWebhook(secret?: string): void {
    if (this.webhookSecret && secret !== this.webhookSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
  }

  async handleAyrshareWebhook(payload: AyrshareWebhookPayload): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Received Ayrshare webhook: ${JSON.stringify(payload).slice(0, 200)}...`);

    // Extract Facebook/Instagram post ID from Ayrshare payload
    const postInfo = payload.post?.postIds?.find(
      (p) => p.platform === 'facebook' || p.platform === 'instagram',
    );

    if (!postInfo?.postId) {
      this.logger.warn('No Facebook/Instagram post ID in webhook');
      return { success: false, message: 'No valid post ID found' };
    }

    const postId = postInfo.postId;
    const content = payload.post?.post || '';

    // Find restaurant by refId (should be facebook_page_id)
    // Ayrshare allows setting a refId when creating posts
    const pageId = payload.refId || payload.profile;
    if (!pageId) {
      this.logger.warn('No page identifier in webhook');
      return { success: false, message: 'No page identifier found' };
    }

    const restaurant = await this.supabase.getRestaurantByPageId(pageId);
    if (!restaurant) {
      this.logger.warn(`Restaurant not found for page: ${pageId}`);
      return { success: false, message: `Restaurant not found for page: ${pageId}` };
    }

    try {
      await this.posts.processPost({
        restaurant,
        postId,
        content,
        payload: payload as Record<string, unknown>,
      });

      return { success: true, message: `Post ${postId} processed successfully` };
    } catch (error) {
      this.logger.error(`Failed to process webhook: ${error}`);
      return { success: false, message: `Processing failed: ${error}` };
    }
  }
}
