import { Module } from '@nestjs/common';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { SupabaseService } from '../../services/supabase.service';
import { MetaApiService } from '../../services/meta-api.service';

@Module({
  controllers: [SchedulerController],
  providers: [SchedulerService, SupabaseService, MetaApiService],
})
export class SchedulerModule {}
