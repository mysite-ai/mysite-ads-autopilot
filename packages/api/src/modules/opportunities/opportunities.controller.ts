import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { OpportunitiesService, CreateOpportunityDto, UpdateOpportunityDto } from './opportunities.service';

@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Get()
  async getAll(@Query('rid') rid?: string) {
    const ridNum = rid ? parseInt(rid, 10) : undefined;
    return this.opportunitiesService.getAll(ridNum);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.opportunitiesService.getById(id);
  }

  @Get('by-pk/:rid/:pk')
  async getByPk(@Param('rid') rid: string, @Param('pk') pk: string) {
    return this.opportunitiesService.getByPk(parseInt(rid, 10), parseInt(pk, 10));
  }

  @Post()
  async create(@Body() dto: CreateOpportunityDto) {
    return this.opportunitiesService.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateOpportunityDto) {
    return this.opportunitiesService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.opportunitiesService.delete(id);
  }
}
