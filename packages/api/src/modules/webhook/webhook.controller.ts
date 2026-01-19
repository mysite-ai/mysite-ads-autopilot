import { Controller, Post, Body, Headers } from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
  constructor(private service: WebhookService) {}

  @Post('ayrshare')
  async handleAyrshare(
    @Body() payload: Record<string, unknown>,
    @Headers('x-webhook-secret') secret?: string,
  ) {
    this.service.validateWebhook(secret);
    return this.service.handleAyrshareWebhook(payload);
  }
}
