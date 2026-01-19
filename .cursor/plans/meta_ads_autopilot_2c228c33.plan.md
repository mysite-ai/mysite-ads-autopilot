---
name: Meta Ads Autopilot
overview: Monolit z dwoma projektami (NestJS API + React App) hostowany na Vercel, używający Supabase jako bazy danych i OpenRouter do kategoryzacji postów przez LLM.
todos:
  - id: setup-monorepo
    content: Inicjalizacja monorepo (pnpm workspaces) + NestJS API + React Vite App
    status: completed
  - id: setup-supabase
    content: Schemat bazy danych w Supabase (tabele + RLS off)
    status: completed
    dependencies:
      - setup-monorepo
  - id: meta-api-service
    content: Meta API Service - createCampaign, createAdSet, createCreative, createAd, updateStatus
    status: completed
    dependencies:
      - setup-monorepo
  - id: llm-service
    content: LLM Service (OpenRouter) - kategoryzacja postów
    status: completed
    dependencies:
      - setup-monorepo
  - id: webhook-endpoint
    content: Webhook endpoint + pełny flow przetwarzania posta
    status: completed
    dependencies:
      - meta-api-service
      - llm-service
      - setup-supabase
  - id: scheduler
    content: Scheduler - expire posts (cron + manual trigger)
    status: completed
    dependencies:
      - meta-api-service
      - setup-supabase
  - id: react-ui
    content: React UI - Dashboard, Restaurant Form, Ad Set Config, Posts Log
    status: completed
    dependencies:
      - setup-supabase
  - id: vercel-deploy
    content: Konfiguracja Vercel (vercel.json, env vars, cron)
    status: completed
    dependencies:
      - webhook-endpoint
      - scheduler
      - react-ui
---

# Meta Ads Autopilot - Plan Architektury

## Struktura Projektu

```
meta-ads-autopilot/
├── packages/
│   ├── api/                 # NestJS API
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── restaurants/
│   │   │   │   ├── campaigns/
│   │   │   │   ├── ad-sets/
│   │   │   │   ├── ads/
│   │   │   │   ├── posts/
│   │   │   │   ├── webhook/
│   │   │   │   └── scheduler/
│   │   │   ├── services/
│   │   │   │   ├── meta-api.service.ts
│   │   │   │   ├── llm.service.ts
│   │   │   │   └── supabase.service.ts
│   │   │   └── main.ts
│   │   └── package.json
│   └── app/                 # React + Vite
│       ├── src/
│       │   ├── pages/
│       │   │   ├── Dashboard.tsx
│       │   │   ├── Restaurants.tsx
│       │   │   └── AdSetConfig.tsx
│       │   └── components/
│       └── package.json
├── package.json             # Workspace root
└── vercel.json
```

## Schemat Bazy Danych (Supabase)

```mermaid
erDiagram
    restaurants {
        uuid id PK
        text name
        text code "2-4 letter abbreviation"
        text website
        text area "S-CITY|M-CITY|L-CITY"
        text fame "Neutral|Hot|Epic"
        int delivery_radius_km
        jsonb budget_priorities "Event:30,Lunch:20..."
        text facebook_page_id
        text instagram_account_id
        text meta_campaign_id
        jsonb location "lat,lng,address"
        timestamp created_at
    }
    
    ad_set_categories {
        uuid id PK
        text code "EV_ALL|LU_ONS|..."
        text name
        text parent_category "Event|Lunch|Promo|Product|Brand|Info"
        jsonb targeting_template
        boolean requires_delivery
        boolean is_event_type
        timestamp created_at
    }
    
    ad_sets {
        uuid id PK
        uuid restaurant_id FK
        uuid category_id FK
        text meta_ad_set_id
        text name "BF_EV_ALL_01"
        int version
        int ads_count
        text status "ACTIVE|PAUSED"
        text event_identifier "nullable - for event ad sets"
        timestamp created_at
    }
    
    posts {
        uuid id PK
        uuid restaurant_id FK
        uuid ad_set_id FK
        text meta_post_id
        text meta_ad_id
        text meta_creative_id
        text content
        text category_code
        date event_date "nullable"
        date promotion_end_date
        text status "PENDING|ACTIVE|PAUSED|EXPIRED"
        jsonb ayrshare_payload
        timestamp created_at
    }
    
    events {
        uuid id PK
        uuid restaurant_id FK
        uuid ad_set_id FK
        text identifier "walentynki-2026|koncert-krawczyk"
        text name
        date event_date
        timestamp created_at
    }
    
    restaurants ||--o{ ad_sets : has
    restaurants ||--o{ posts : has
    restaurants ||--o{ events : has
    ad_set_categories ||--o{ ad_sets : defines
    ad_sets ||--o{ posts : contains
    ad_sets ||--o| events : tracks
```

## Flow Przetwarzania Postów

```mermaid
flowchart TD
    A[Webhook: Ayrshare Post] --> B[Zapisz do posts - status PENDING]
    B --> C[LLM: Kategoryzacja]
    C --> D{Kategoria?}
    
    D -->|Event| E[Wygeneruj event_identifier]
    E --> F{Event istnieje?}
    F -->|Tak| G[Użyj istniejącego ad_set]
    F -->|Nie| H[Stwórz nowy ad_set + event]
    
    D -->|Non-Event| I{Ad Set istnieje?}
    I -->|Tak| J{Ads count < 50?}
    I -->|Nie| K[Stwórz ad_set v01]
    J -->|Tak| G
    J -->|Nie| L[Stwórz ad_set v02+]
    
    G --> M[Meta API: Create Creative]
    H --> M
    K --> M
    L --> M
    
    M --> N[Meta API: Create Ad]
    N --> O[Update post status: ACTIVE]
```

## Kluczowe Komponenty

### 1. Meta API Service

Bezpośrednie wywołania Graph API (bez SDK):

- `createCampaign(restaurantName)` - OUTCOME_ENGAGEMENT objective
- `createAdSet(campaignId, name, targeting, dailyBudget)`
- `createCreative(pageId, postId)` - użycie istniejącego posta
- `createAd(adSetId, creativeId, name)`
- `updateAdStatus(adId, status)` - ACTIVE/PAUSED
- `getAudienceSize(targeting)` - estimated reach

### 2. LLM Service (OpenRouter)

Prompt do kategoryzacji:

```
Analizujesz post restauracji. Wyciągnij:
1. category: jedno z [EV_ALL|EV_FAM|EV_PAR|EV_SEN|LU_ONS|LU_DEL|PR_ONS_CYK|PR_ONS_JED|PR_DEL_CYK|PR_DEL_JED|PD_ONS|PD_DEL|BRAND|INFO]
2. event_date: jeśli to wydarzenie (format YYYY-MM-DD)
3. event_identifier: jeśli event - krótki slug (np. "walentynki-2026")
4. promotion_end_date: sugerowana data końca promocji (max 60 dni od dziś, dla eventów = event_date)

Post: {content}
Odpowiedz jako JSON.
```

### 3. Scheduler Service

- Cron job: codziennie o 00:01
- Endpoint: `POST /api/scheduler/expire-posts` (manual trigger z UI)
- Query: `SELECT * FROM posts WHERE promotion_end_date <= TODAY AND status = 'ACTIVE'`
- Dla każdego: `updateAdStatus(meta_ad_id, 'PAUSED')`

### 4. Targeting Templates

```typescript
const targetingTemplates = {
  base: (restaurant) => ({
    geo_locations: {
      custom_locations: [{
        latitude: restaurant.location.lat,
        longitude: restaurant.location.lng,
        radius: restaurant.area === 'S-CITY' ? 5 : 
                restaurant.area === 'M-CITY' ? 10 : 15,
        distance_unit: 'kilometer'
      }]
    },
    age_min: 18,
    age_max: 65
  }),
  delivery: (restaurant) => ({
    ...base(restaurant),
    geo_locations: {
      custom_locations: [{
        ...base.geo_locations.custom_locations[0],
        radius: restaurant.delivery_radius_km
      }]
    }
  }),
  event_family: { flexible_spec: [{ interests: [{ id: '6003139266461', name: 'Family' }] }] },
  event_couple: { age_min: 21, age_max: 45, flexible_spec: [{ interests: [{ id: '6003248649975', name: 'Dating' }] }] },
  event_senior: { age_min: 55, age_max: 65 }
}
```

## UI (React)

### Strony:

1. **Dashboard** - lista restauracji + status postów
2. **Restaurant Form** - dodawanie/edycja restauracji

   - Name, Code, Website
   - Area (S/M/L-CITY), Fame
   - Location (lat/lng + adres)
   - Delivery radius
   - Facebook Page ID, Instagram Account ID
   - Budget priorities (% per kategoria)

3. **Ad Set Config** - edycja kategorii ad setów

   - Lista kategorii z targeting templates
   - Możliwość edycji targetingu per kategoria

4. **Posts Log** - historia przetworzonych postów

## Zmienne Środowiskowe

```env
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# Meta
META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=

# OpenRouter
OPENROUTER_API_KEY=

# App
WEBHOOK_SECRET= # dla weryfikacji Ayrshare
```

## Deployment (Vercel)

- `packages/api` -> Serverless Functions
- `packages/app` -> Static Site
- Cron job via Vercel Cron (`vercel.json`)

## Kluczowe Decyzje Techniczne

1. **Idempotencja**: Każdy post ma unikalny `meta_post_id` - zapobiega duplikatom przy retry
2. **Bullet-proof**: Posty najpierw zapisywane jako PENDING, status zmienia się po sukcesie Meta API
3. **Event isolation**: Każdy unikalny event (po `event_identifier`) = osobny ad_set
4. **50 ads limit**: Automatyczne tworzenie nowej wersji ad_set gdy limit osiągnięty
5. **Beneficiary/Payer**: Hardcoded w createCreative - Beneficiary: restaurant.name, Payer: "your_agency_name"

## Meta API - Potrzebne Permissions

Twoja Meta App musi mieć:

- `ads_management` - zarządzanie reklamami
- `pages_read_engagement` - odczyt postów
- `business_management` - dostęp do ad account