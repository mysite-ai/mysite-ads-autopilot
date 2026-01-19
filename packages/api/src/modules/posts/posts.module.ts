import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { SupabaseService } from '../../services/supabase.service';
import { MetaApiService } from '../../services/meta-api.service';
import { LlmService } from '../../services/llm.service';
import { AdSetsService } from '../ad-sets/ad-sets.service';

@Module({
  controllers: [PostsController],
  providers: [PostsService, SupabaseService, MetaApiService, LlmService, AdSetsService, SupabaseService],
  exports: [PostsService],
})
export class PostsModule {}
