import { Module } from '@nestjs/common';
import { TrackingLinksController } from './tracking-links.controller';
import { TrackingLinkService } from '../../services/tracking-link.service';
import { SupabaseService } from '../../services/supabase.service';

@Module({
  controllers: [TrackingLinksController],
  providers: [TrackingLinkService, SupabaseService],
  exports: [TrackingLinkService],
})
export class TrackingLinksModule {}
