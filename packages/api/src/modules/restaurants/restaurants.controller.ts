import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { RestaurantsService, CreateRestaurantDto } from './restaurants.service';

@Controller('restaurants')
export class RestaurantsController {
  constructor(private service: RestaurantsService) {}

  @Get()
  getAll() {
    return this.service.getAll();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post()
  create(@Body() dto: CreateRestaurantDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateRestaurantDto>) {
    return this.service.update(id, dto);
  }
}
