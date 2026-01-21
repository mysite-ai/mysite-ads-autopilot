import { Module } from '@nestjs/common';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';
import { SupabaseService } from '../../services/supabase.service';

@Module({
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService, SupabaseService],
  exports: [OpportunitiesService],
})
export class OpportunitiesModule {}
