import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService, Post, Restaurant, OfferType } from '../../services/supabase.service';
import { MetaApiService } from '../../services/meta-api.service';
import { LlmService } from '../../services/llm.service';
import { AdSetsService } from '../ad-sets/ad-sets.service';
import { OpportunitiesService } from '../opportunities/opportunities.service';
import { TrackingLinkService } from '../../services/tracking-link.service';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    private supabase: SupabaseService,
    private metaApi: MetaApiService,
    private llm: LlmService,
    private adSets: AdSetsService,
    private opportunities: OpportunitiesService,
    private trackingLinks: TrackingLinkService,
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

    // === KROK 1: Kategoryzacja LLM ===
    this.logger.log(`[1/6] Kategoryzacja LLM dla posta ${postId}...`);
    const categorization = await this.llm.categorizePost(content);
    this.logger.log(`[1/6] ✅ Skategoryzowano: ${categorization.category}`);

    // === KROK 2: Pobierz lub stwórz Opportunity (PK) ===
    this.logger.log(`[2/6] Pobieranie/tworzenie Opportunity dla ${categorization.category}...`);
    const offerType = this.categoryToOfferType(categorization.category);
    const opportunity = await this.opportunities.getOrCreateForOfferType(restaurant.rid, offerType);
    this.logger.log(`[2/6] ✅ Opportunity: pk=${opportunity.pk}, name="${opportunity.name}"`);

    // === KROK 3: Pobierz lub stwórz Ad Set z PK ===
    this.logger.log(`[3/6] Pobieranie/tworzenie Ad Set dla pk${opportunity.pk}_${categorization.category}...`);
    const isEvent = categorization.category.startsWith('EV_');
    const eventIdentifier = isEvent ? categorization.event_identifier : undefined;
    
    let adSet;
    try {
      adSet = await this.adSets.getOrCreateAdSetWithPk(
        restaurant,
        opportunity,
        categorization.category,
        eventIdentifier || undefined,
      );
      this.logger.log(`[3/6] ✅ Ad Set: ${adSet.name} (pk=${opportunity.pk})`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`Nie udało się utworzyć Ad Set: ${msg}`);
    }

    // === KROK 4: Wygeneruj URL params dla trackingu ===
    let urlParams: string | undefined;
    if (restaurant.website) {
      urlParams = this.trackingLinks.generateMetaUrlParams({
        rid: restaurant.rid,
        pk: opportunity.pk,
        opportunitySlug: opportunity.slug,
        categoryCode: categorization.category,
        version: adSet.version,
      });
      this.logger.log(`[4/6] ✅ URL Params: ${urlParams}`);
    } else {
      this.logger.log(`[4/6] ⚠️ Brak website - pomijam tracking URL params`);
    }

    // === KROK 5: Tworzenie Creative z URL tags (tracking) ===
    this.logger.log(`[5/6] Tworzenie Creative (object_story_id: ${restaurant.facebook_page_id}_${postId})...`);
    let creativeId: string;
    try {
      creativeId = await this.metaApi.createCreative({
        pageId: restaurant.facebook_page_id,
        postId,
        websiteUrl: restaurant.website || undefined,
        urlTags: urlParams,
      });
      this.logger.log(`[5/6] ✅ Creative ID: ${creativeId}`);
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

    // === KROK 6: Utwórz reklamę ===
    this.logger.log(`[6/6] Tworzenie reklamy pk${opportunity.pk}_...`);
    let adId: string;
    try {
      adId = await this.metaApi.createAd({
        adSetId: adSet.meta_ad_set_id!,
        creativeId,
        pk: opportunity.pk,
      });
      this.logger.log(`[6/6] ✅ Ad: pk${opportunity.pk}_${adId}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`❌ Błąd Meta API przy tworzeniu Reklamy: ${msg}`);
    }

    // === KROK 7: Zapisz do bazy ===
    this.logger.log(`[7/7] Zapisywanie do bazy...`);
    
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

    // Zapisz post jako ACTIVE z PK
    const post = await this.supabase.createPost({
      restaurant_id: restaurant.id,
      meta_post_id: postId,
      content,
      status: 'ACTIVE',
      ayrshare_payload: payload,
      ad_set_id: adSet.id,
      opportunity_id: opportunity.id,
      pk: opportunity.pk,
      meta_ad_id: adId,
      meta_creative_id: creativeId,
      category_code: categorization.category,
      event_date: categorization.event_date,
      promotion_end_date: categorization.promotion_end_date,
    });

    // Zapisz tracking link do bazy (z rzeczywistym ad_id zamiast {{ad.id}})
    if (restaurant.website) {
      try {
        await this.trackingLinks.createAndSaveTrackingLink({
          rid: restaurant.rid,
          pi: 1, // Meta Ads
          pk: opportunity.pk,
          ps: adId,
          destinationUrl: restaurant.website,
          opportunitySlug: opportunity.slug,
          categoryCode: categorization.category,
          version: adSet.version,
        }, post.id);
        this.logger.log(`[7/7] ✅ Tracking link zapisany do bazy`);
      } catch (error) {
        this.logger.warn(`Nie udało się zapisać tracking link: ${error}`);
      }
    }

    this.logger.log(`[7/7] ✅ Zapisano post ${post.id}`);
    this.logger.log(`🎉 POST PRZETWORZONY: ${postId} → pk=${opportunity.pk}, kategoria=${categorization.category}, ad=${adId}, urlParams=${urlParams ? 'tak' : 'brak'}`);
    
    return post;
  }

  /**
   * Map category code to offer type
   */
  private categoryToOfferType(category: string): OfferType {
    if (category.startsWith('EV_')) return 'event';
    if (category.startsWith('LU_')) return 'lunch';
    if (category.startsWith('PR_')) return 'promo';
    if (category.startsWith('PD_')) return 'product';
    if (category === 'BRAND') return 'brand';
    return 'info';
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
