import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { SupabaseService } from '../../services/supabase.service';
import { PostsService } from '../posts/posts.service';
import { MetaApiService } from '../../services/meta-api.service';
import { LlmService } from '../../services/llm.service';
import { AdSetsService } from '../ad-sets/ad-sets.service';

@Module({
  controllers: [WebhookController],
  providers: [
    WebhookService,
    SupabaseService,
    PostsService,
    MetaApiService,
    LlmService,
    AdSetsService,
  ],
})
export class WebhookModule {}
