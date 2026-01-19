import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService, Post, Restaurant } from '../../services/supabase.service';
import { MetaApiService } from '../../services/meta-api.service';
import { LlmService } from '../../services/llm.service';
import { AdSetsService } from '../ad-sets/ad-sets.service';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    private supabase: SupabaseService,
    private metaApi: MetaApiService,
    private llm: LlmService,
    private adSets: AdSetsService,
  ) {}

  async getAll(restaurantId?: string): Promise<Post[]> {
    return this.supabase.getPosts(restaurantId);
  }

  async processPost(params: {
    restaurant: Restaurant;
    postId: string;
    content: string;
    payload: Record<string, unknown>;
  }): Promise<Post> {
    const { restaurant, postId, content, payload } = params;

    // Walidacja wejścia
    if (!postId || postId.trim().length < 10) {
      throw new BadRequestException('Post ID jest za krótki lub pusty. Podaj prawidłowy Post ID z Facebooka.');
    }

    if (!content || content.trim().length < 5) {
      throw new BadRequestException('Treść posta jest wymagana do kategoryzacji. Wklej treść posta z Facebooka.');
    }

    if (!restaurant.facebook_page_id) {
      throw new BadRequestException(`Restauracja "${restaurant.name}" nie ma ustawionego Facebook Page ID! Dodaj go w ustawieniach restauracji.`);
    }

    if (!restaurant.meta_campaign_id) {
      throw new BadRequestException(`Restauracja "${restaurant.name}" nie ma kampanii Meta! Kliknij "Utwórz kampanię" w ustawieniach restauracji.`);
    }

    // Sprawdź czy post już istnieje i jest ACTIVE
    const existing = await this.supabase.getPostByMetaId(postId);
    if (existing && existing.status === 'ACTIVE') {
      throw new BadRequestException(`Post ${postId} już został przetworzony i jest aktywny.`);
    }

    // Jeśli post istnieje w PENDING - usuń go i przetwórz od nowa
    if (existing) {
      await this.supabase.deletePost(existing.id);
      this.logger.log(`Usunięto stary pending post ${postId}, przetwarzam od nowa`);
    }

    // === KROK 1: NAJPIERW Creative - żeby sprawdzić czy post może być promowany ===
    this.logger.log(`[1/5] Tworzenie Creative (object_story_id: ${restaurant.facebook_page_id}_${postId}, website: ${restaurant.website || 'brak'})...`);
    let creativeId: string;
    try {
      creativeId = await this.metaApi.createCreative({
        pageId: restaurant.facebook_page_id,
        postId,
        websiteUrl: restaurant.website || undefined,
      });
      this.logger.log(`[1/5] ✅ Creative ID: ${creativeId}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      
      // Parsuj błąd Meta żeby dać lepszy komunikat
      if (msg.includes("Can't Be Boosted") || msg.includes('issue with this post')) {
        throw new BadRequestException(
          `❌ Meta odrzuciła ten post!\n\n` +
          `Powód: Post nie może być promowany.\n\n` +
          `Możliwe przyczyny:\n` +
          `• Post ID jest nieprawidłowy lub nie istnieje\n` +
          `• Post należy do innej strony FB (nie ${restaurant.facebook_page_id})\n` +
          `• Post został usunięty\n` +
          `• Post zawiera treści ograniczone (muzyka, prawa autorskie)\n` +
          `• Post jest draft/niepublikowany\n\n` +
          `Sprawdź Post ID w Facebook Business Suite!`
        );
      }
      
      throw new BadRequestException(`❌ Błąd Meta API przy tworzeniu Creative: ${msg}`);
    }

    // === KROK 2: Kategoryzacja LLM ===
    this.logger.log(`[2/5] Kategoryzacja LLM dla posta ${postId}...`);
    const categorization = await this.llm.categorizePost(content);
    this.logger.log(`[2/5] ✅ Skategoryzowano: ${categorization.category}`);

    // === KROK 3: Pobierz lub stwórz Ad Set (DOPIERO teraz, bo Creative się udał) ===
    this.logger.log(`[3/5] Pobieranie/tworzenie Ad Set dla kategorii ${categorization.category}...`);
    const isEvent = categorization.category.startsWith('EV_');
    const eventIdentifier = isEvent ? categorization.event_identifier : undefined;
    
    let adSet;
    try {
      adSet = await this.adSets.getOrCreateAdSet(
        restaurant,
        categorization.category,
        eventIdentifier || undefined,
      );
      this.logger.log(`[3/5] ✅ Ad Set: ${adSet.name} (isNew: ${!adSet.meta_ad_set_id ? 'YES' : 'NO'})`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`Nie udało się utworzyć Ad Set: ${msg}`);
    }

    // === KROK 4: Utwórz reklamę ===
    const postIdLast6 = postId.slice(-6);
    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, '0')}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getFullYear().toString().slice(-2)}`;
    const adName = `${adSet.name}_${postIdLast6}_${dateStr}`;

    this.logger.log(`[4/5] Tworzenie reklamy: ${adName}...`);
    let adId: string;
    try {
      adId = await this.metaApi.createAd({
        adSetId: adSet.meta_ad_set_id!,
        creativeId,
        name: adName,
      });
      this.logger.log(`[4/5] ✅ Ad ID: ${adId}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`❌ Błąd Meta API przy tworzeniu Reklamy: ${msg}`);
    }

    // === KROK 5: Zapisz do bazy - wszystko się udało! ===
    this.logger.log(`[5/5] Zapisywanie do bazy...`);
    
    // Utwórz event jeśli to wydarzenie
    if (isEvent && eventIdentifier && categorization.event_date) {
      const existingEvent = await this.supabase.getEvent(restaurant.id, eventIdentifier);
      if (!existingEvent) {
        await this.supabase.createEvent({
          restaurant_id: restaurant.id,
          ad_set_id: adSet.id,
          identifier: eventIdentifier,
          name: eventIdentifier.replace(/-/g, ' '),
          event_date: categorization.event_date,
        });
      }
    }

    // Zwiększ licznik reklam w ad set
    await this.supabase.incrementAdSetCount(adSet.id);

    // Zapisz post jako ACTIVE
    const post = await this.supabase.createPost({
      restaurant_id: restaurant.id,
      meta_post_id: postId,
      content,
      status: 'ACTIVE',
      ayrshare_payload: payload,
      ad_set_id: adSet.id,
      meta_ad_id: adId,
      meta_creative_id: creativeId,
      category_code: categorization.category,
      event_date: categorization.event_date,
      promotion_end_date: categorization.promotion_end_date,
    });

    this.logger.log(`[5/5] ✅ Zapisano post ${post.id}`);
    this.logger.log(`🎉 POST PRZETWORZONY POMYŚLNIE: ${postId} → Kategoria: ${categorization.category}, Ad: ${adId}`);
    
    return post;
  }

  async pausePost(postId: string): Promise<Post> {
    const post = await this.supabase.getPost(postId);
    if (!post) {
      throw new BadRequestException(`Post nie znaleziony: ${postId}`);
    }

    if (post.meta_ad_id) {
      await this.metaApi.updateAdStatus(post.meta_ad_id, 'PAUSED');
    }

    return this.supabase.updatePost(post.id, { status: 'PAUSED' });
  }

  async activatePost(postId: string): Promise<Post> {
    const post = await this.supabase.getPost(postId);
    if (!post) {
      throw new BadRequestException(`Post nie znaleziony: ${postId}`);
    }

    if (post.meta_ad_id) {
      await this.metaApi.updateAdStatus(post.meta_ad_id, 'ACTIVE');
    }

    return this.supabase.updatePost(post.id, { status: 'ACTIVE' });
  }

  async retryPost(postId: string): Promise<Post> {
    const post = await this.supabase.getPost(postId);
    if (!post) {
      throw new BadRequestException(`Post nie znaleziony: ${postId}`);
    }

    const restaurant = await this.supabase.getRestaurant(post.restaurant_id);
    if (!restaurant) {
      throw new BadRequestException(`Restauracja nie znaleziona: ${post.restaurant_id}`);
    }

    // Usuń stary post i przetwórz od nowa
    await this.supabase.deletePost(postId);

    return this.processPost({
      restaurant,
      postId: post.meta_post_id,
      content: post.content || '',
      payload: post.ayrshare_payload || { retry: true },
    });
  }

  async deletePost(postId: string): Promise<{ success: boolean }> {
    const post = await this.supabase.getPost(postId);
    
    // Usuń reklamę z Meta jeśli istnieje
    if (post?.meta_ad_id) {
      try {
        await this.metaApi.deleteAd(post.meta_ad_id);
        this.logger.log(`Usunięto reklamę z Meta: ${post.meta_ad_id}`);
      } catch (error) {
        this.logger.warn(`Nie udało się usunąć reklamy z Meta: ${error}`);
      }
    }
    
    await this.supabase.deletePost(postId);
    this.logger.log(`Usunięto post ${postId}`);
    return { success: true };
  }
}
