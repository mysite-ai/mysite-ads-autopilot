import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { PostsService } from './posts.service';
import { SupabaseService } from '../../services/supabase.service';

interface ManualPostDto {
  restaurant_id: string;
  post_id: string;
  content: string;
}

@Controller('posts')
export class PostsController {
  constructor(
    private service: PostsService,
    private supabase: SupabaseService,
  ) {}

  @Get()
  getAll(@Query('restaurantId') restaurantId?: string) {
    return this.service.getAll(restaurantId);
  }

  @Post('manual')
  async addManual(@Body() dto: ManualPostDto) {
    const restaurant = await this.supabase.getRestaurant(dto.restaurant_id);
    if (!restaurant) {
      throw new Error(`Restaurant not found: ${dto.restaurant_id}`);
    }

    return this.service.processPost({
      restaurant,
      postId: dto.post_id,
      content: dto.content,
      payload: { manual: true },
    });
  }

  @Post(':id/pause')
  pause(@Param('id') id: string) {
    return this.service.pausePost(id);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.service.activatePost(id);
  }
}
