import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService, Post, Restaurant } from '../../services/supabase.service';
import { MetaApiService } from '../../services/meta-api.service';
import { LlmService } from '../../services/llm.service';
import { AdSetsService } from '../ad-sets/ad-sets.service';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    private supabase: SupabaseService,
    private metaApi: MetaApiService,
    private llm: LlmService,
    private adSets: AdSetsService,
  ) {}

  async getAll(restaurantId?: string): Promise<Post[]> {
    return this.supabase.getPosts(restaurantId);
  }

  async processPost(params: {
    restaurant: Restaurant;
    postId: string;
    content: string;
    payload: Record<string, unknown>;
  }): Promise<Post> {
    const { restaurant, postId, content, payload } = params;

    // Check if already processed (idempotency)
    const existing = await this.supabase.getPostByMetaId(postId);
    if (existing) {
      this.logger.log(`Post ${postId} already processed`);
      return existing;
    }

    // 1. Save as PENDING
    let post = await this.supabase.createPost({
      restaurant_id: restaurant.id,
      meta_post_id: postId,
      content,
      status: 'PENDING',
      ayrshare_payload: payload,
    });

    try {
      // 2. Categorize with LLM
      const categorization = await this.llm.categorizePost(content);
      this.logger.log(`Categorized post ${postId}: ${categorization.category}`);

      // 3. Check if this is an event category
      const isEvent = categorization.category.startsWith('EV_');
      let eventIdentifier: string | undefined;

      if (isEvent && categorization.event_identifier) {
        eventIdentifier = categorization.event_identifier;
        
        // Check if event already exists
        const existingEvent = await this.supabase.getEvent(
          restaurant.id,
          eventIdentifier,
        );

        if (!existingEvent && categorization.event_date) {
          // Create new event record
          const adSet = await this.adSets.getOrCreateAdSet(
            restaurant,
            categorization.category,
            eventIdentifier,
          );

          await this.supabase.createEvent({
            restaurant_id: restaurant.id,
            ad_set_id: adSet.id,
            identifier: eventIdentifier,
            name: eventIdentifier.replace(/-/g, ' '),
            event_date: categorization.event_date,
          });
        }
      }

      // 4. Get or create ad set
      const adSet = await this.adSets.getOrCreateAdSet(
        restaurant,
        categorization.category,
        eventIdentifier,
      );

      // 5. Create creative from existing post
      const creativeId = await this.metaApi.createCreative({
        pageId: restaurant.facebook_page_id,
        postId,
        restaurantName: restaurant.name,
      });

      // 6. Create ad with naming convention
      const postIdLast6 = postId.slice(-6);
      const today = new Date();
      const dateStr = `${today.getDate().toString().padStart(2, '0')}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getFullYear().toString().slice(-2)}`;
      const adName = `${adSet.name}_${postIdLast6}_${dateStr}`;

      const adId = await this.metaApi.createAd({
        adSetId: adSet.meta_ad_set_id!,
        creativeId,
        name: adName,
      });

      // 7. Increment ad set count
      await this.supabase.incrementAdSetCount(adSet.id);

      // 8. Update post with all info
      post = await this.supabase.updatePost(post.id, {
        ad_set_id: adSet.id,
        meta_ad_id: adId,
        meta_creative_id: creativeId,
        category_code: categorization.category,
        event_date: categorization.event_date,
        promotion_end_date: categorization.promotion_end_date,
        status: 'ACTIVE',
      });

      this.logger.log(`Successfully processed post ${postId} -> ad ${adId}`);
      return post;
    } catch (error) {
      this.logger.error(`Failed to process post ${postId}: ${error}`);
      
      // Update post with error status
      await this.supabase.updatePost(post.id, {
        status: 'PENDING', // Keep as pending for retry
      });
      
      throw error;
    }
  }

  async pausePost(postId: string): Promise<Post> {
    const post = await this.supabase.getPostByMetaId(postId);
    if (!post) {
      throw new Error(`Post not found: ${postId}`);
    }

    if (post.meta_ad_id) {
      await this.metaApi.updateAdStatus(post.meta_ad_id, 'PAUSED');
    }

    return this.supabase.updatePost(post.id, { status: 'PAUSED' });
  }

  async activatePost(postId: string): Promise<Post> {
    const post = await this.supabase.getPostByMetaId(postId);
    if (!post) {
      throw new Error(`Post not found: ${postId}`);
    }

    if (post.meta_ad_id) {
      await this.metaApi.updateAdStatus(post.meta_ad_id, 'ACTIVE');
    }

    return this.supabase.updatePost(post.id, { status: 'ACTIVE' });
  }
}
