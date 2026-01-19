import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { RestaurantsModule } from './modules/restaurants/restaurants.module';
import { PostsModule } from './modules/posts/posts.module';
import { AdSetsModule } from './modules/ad-sets/ad-sets.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { SupabaseService } from './services/supabase.service';
import { MetaApiService } from './services/meta-api.service';
import { LlmService } from './services/llm.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    RestaurantsModule,
    PostsModule,
    AdSetsModule,
    WebhookModule,
    SchedulerModule,
  ],
  providers: [SupabaseService, MetaApiService, LlmService],
  exports: [SupabaseService, MetaApiService, LlmService],
})
export class AppModule {}
