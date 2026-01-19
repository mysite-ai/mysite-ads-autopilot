import { Controller, Get, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { AdSetsService } from './ad-sets.service';
import { AdSetCategory } from '../../services/supabase.service';

@Controller('ad-sets')
export class AdSetsController {
  constructor(private service: AdSetsService) {}

  @Get('categories')
  getCategories() {
    return this.service.getCategories();
  }

  @Put('categories/:id')
  updateCategory(
    @Param('id') id: string,
    @Body() updates: Partial<AdSetCategory>,
  ) {
    return this.service.updateCategory(id, updates);
  }

  @Get('events')
  getEvents(@Query('restaurantId') restaurantId?: string) {
    return this.service.getEvents(restaurantId);
  }

  @Get()
  getAdSets(@Query('restaurantId') restaurantId?: string) {
    return this.service.getAdSets(restaurantId);
  }

  @Delete(':id')
  deleteAdSet(@Param('id') id: string) {
    return this.service.deleteAdSet(id);
  }
}
