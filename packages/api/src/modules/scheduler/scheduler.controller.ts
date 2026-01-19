import { Controller, Post } from '@nestjs/common';
import { SchedulerService, ExpireResult } from './scheduler.service';

@Controller('scheduler')
export class SchedulerController {
  constructor(private service: SchedulerService) {}

  @Post('expire-posts')
  async expirePosts(): Promise<ExpireResult> {
    return this.service.expirePosts();
  }
}
