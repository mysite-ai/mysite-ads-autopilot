import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { TrackingLinkService, TrackingLinkParams, GeneratedLink } from '../../services/tracking-link.service';

interface GenerateLinkDto {
  rid: number;
  pi: number;
  pk: number;
  ps: string;
  destinationUrl: string;
  opportunitySlug: string;
  categoryCode: string;
  version: number;
  save?: boolean;  // If true, save to database
}

interface GenerateMetaLinkDto {
  rid: number;
  pk: number;
  destinationUrl: string;
  opportunitySlug: string;
  categoryCode: string;
  version: number;
  save?: boolean;
}

@Controller('tracking-links')
export class TrackingLinksController {
  constructor(private readonly trackingLinkService: TrackingLinkService) {}

  @Get()
  async getAll(@Query('rid') rid?: string, @Query('pk') pk?: string) {
    const ridNum = rid ? parseInt(rid, 10) : undefined;
    const pkNum = pk ? parseInt(pk, 10) : undefined;
    return this.trackingLinkService.getTrackingLinks(ridNum, pkNum);
  }

  @Get('platforms')
  async getPlatforms() {
    return this.trackingLinkService.getPlatforms();
  }

  @Post('generate')
  async generate(@Body() dto: GenerateLinkDto): Promise<GeneratedLink & { saved?: boolean }> {
    const params: TrackingLinkParams = {
      rid: dto.rid,
      pi: dto.pi,
      pk: dto.pk,
      ps: dto.ps,
      destinationUrl: dto.destinationUrl,
      opportunitySlug: dto.opportunitySlug,
      categoryCode: dto.categoryCode,
      version: dto.version,
    };

    const generated = this.trackingLinkService.generateTrackingLink(params);

    if (dto.save) {
      await this.trackingLinkService.createAndSaveTrackingLink(params);
      return { ...generated, saved: true };
    }

    return generated;
  }

  @Post('generate-meta')
  async generateMeta(@Body() dto: GenerateMetaLinkDto): Promise<GeneratedLink & { saved?: boolean }> {
    const generated = this.trackingLinkService.generateMetaTrackingLink({
      rid: dto.rid,
      pk: dto.pk,
      destinationUrl: dto.destinationUrl,
      opportunitySlug: dto.opportunitySlug,
      categoryCode: dto.categoryCode,
      version: dto.version,
    });

    if (dto.save) {
      await this.trackingLinkService.createAndSaveTrackingLink({
        rid: dto.rid,
        pi: 1,  // Meta
        pk: dto.pk,
        ps: '{{ad.id}}',
        destinationUrl: dto.destinationUrl,
        opportunitySlug: dto.opportunitySlug,
        categoryCode: dto.categoryCode,
        version: dto.version,
      });
      return { ...generated, saved: true };
    }

    return generated;
  }

  @Post('parse')
  async parse(@Body() body: { url: string }) {
    return this.trackingLinkService.parseTrackingUrl(body.url);
  }

  @Post('validate')
  async validate(@Body() body: { url: string }) {
    return this.trackingLinkService.validateTrackingUrl(body.url);
  }
}
