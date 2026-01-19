import { Module } from '@nestjs/common';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantsService } from './restaurants.service';
import { SupabaseService } from '../../services/supabase.service';
import { MetaApiService } from '../../services/meta-api.service';

@Module({
  controllers: [RestaurantsController],
  providers: [RestaurantsService, SupabaseService, MetaApiService],
  exports: [RestaurantsService],
})
export class RestaurantsModule {}
