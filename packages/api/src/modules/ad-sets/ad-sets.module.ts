import { Module } from '@nestjs/common';
import { AdSetsController } from './ad-sets.controller';
import { AdSetsService } from './ad-sets.service';
import { SupabaseService } from '../../services/supabase.service';
import { MetaApiService } from '../../services/meta-api.service';

@Module({
  controllers: [AdSetsController],
  providers: [AdSetsService, SupabaseService, MetaApiService],
  exports: [AdSetsService],
})
export class AdSetsModule {}
