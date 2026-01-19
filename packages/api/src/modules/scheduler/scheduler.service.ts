import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../../services/supabase.service';
import { MetaApiService } from '../../services/meta-api.service';

export interface ExpireResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
}

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private supabase: SupabaseService,
    private metaApi: MetaApiService,
  ) {}

  // Run daily at 00:01
  @Cron('1 0 * * *')
  async handleDailyExpiration(): Promise<void> {
    this.logger.log('Running daily post expiration check');
    await this.expirePosts();
  }

  async expirePosts(): Promise<ExpireResult> {
    const result: ExpireResult = {
      total: 0,
      success: 0,
      failed: 0,
      errors: [],
    };

    try {
      const expiredPosts = await this.supabase.getExpiredPosts();
      result.total = expiredPosts.length;

      this.logger.log(`Found ${result.total} expired posts to disable`);

      for (const post of expiredPosts) {
        try {
          // Pause ad in Meta
          if (post.meta_ad_id) {
            await this.metaApi.updateAdStatus(post.meta_ad_id, 'PAUSED');
          }

          // Update status in database
          await this.supabase.updatePost(post.id, { status: 'EXPIRED' });
          result.success++;

          this.logger.log(`Expired post ${post.meta_post_id}`);
        } catch (error) {
          result.failed++;
          const errorMsg = `Failed to expire ${post.meta_post_id}: ${error}`;
          result.errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }

      this.logger.log(
        `Expiration complete: ${result.success}/${result.total} successful, ${result.failed} failed`,
      );
    } catch (error) {
      this.logger.error(`Expiration job failed: ${error}`);
      result.errors.push(`Job error: ${error}`);
    }

    return result;
  }
}
