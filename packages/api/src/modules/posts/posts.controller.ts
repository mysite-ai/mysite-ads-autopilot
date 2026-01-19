import { Controller, Get, Post, Delete, Body, Param, Query, BadRequestException, Logger } from '@nestjs/common';
import { PostsService } from './posts.service';
import { SupabaseService } from '../../services/supabase.service';

interface ManualPostDto {
  restaurant_id: string;
  post_id: string;
  content: string;
}

@Controller('posts')
export class PostsController {
  private readonly logger = new Logger(PostsController.name);

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
    this.logger.log(`=== DODAWANIE POSTA MANUAL ===`);
    this.logger.log(`Restaurant ID: ${dto.restaurant_id}`);
    this.logger.log(`Post ID: ${dto.post_id}`);
    this.logger.log(`Content: ${dto.content?.substring(0, 100)}...`);

    if (!dto.restaurant_id) {
      throw new BadRequestException('Wybierz restaurację!');
    }
    if (!dto.post_id || dto.post_id.trim().length < 5) {
      throw new BadRequestException('Podaj prawidłowy Post ID!');
    }
    if (!dto.content || dto.content.trim().length < 5) {
      throw new BadRequestException('Wklej treść posta - jest wymagana do kategoryzacji!');
    }

    const restaurant = await this.supabase.getRestaurant(dto.restaurant_id);
    if (!restaurant) {
      throw new BadRequestException(`Restauracja nie znaleziona: ${dto.restaurant_id}`);
    }

    this.logger.log(`Restauracja: ${restaurant.name}, FB Page: ${restaurant.facebook_page_id}`);

    return this.service.processPost({
      restaurant,
      postId: dto.post_id.trim(),
      content: dto.content.trim(),
      payload: { manual: true },
    });
  }

  @Post(':id/retry')
  async retry(@Param('id') id: string) {
    return this.service.retryPost(id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.service.deletePost(id);
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
