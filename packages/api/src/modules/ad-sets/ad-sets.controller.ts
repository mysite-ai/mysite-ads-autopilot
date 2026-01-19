import { Controller, Get, Put, Body, Param, Query } from '@nestjs/common';
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

  @Get()
  getAdSets(@Query('restaurantId') restaurantId?: string) {
    return this.service.getAdSets(restaurantId);
  }
}
