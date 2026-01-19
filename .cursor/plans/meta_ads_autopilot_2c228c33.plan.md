---
name: Meta Ads Autopilot
overview: Monolit z dwoma projektami (NestJS API + React App) hostowany na Vercel, używający Supabase jako bazy danych i OpenRouter do kategoryzacji postów przez LLM. System automatycznie kategoryzuje posty restauracji i tworzy reklamy Meta Ads z odpowiednim targetowaniem.
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
    content: Meta API Service - createCampaign, createAdSet, createCreative, createAd, updateStatus, deleteAdSet, deleteAd
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
    content: React UI - Dashboard, Restaurants, Ad Sets, Events, Posts
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
│   │   │   │   ├── ad-sets/
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
│       │   │   ├── Dashboard.tsx      # Przegląd restauracji
│       │   │   ├── Restaurants.tsx    # CRUD restauracji
│       │   │   ├── AdSetConfig.tsx    # Kategorie + aktywne ad sety
│       │   │   ├── Events.tsx         # Zarządzanie wydarzeniami
│       │   │   └── PostsLog.tsx       # Lista reklam
│       │   ├── api.ts
│       │   ├── types.ts
│       │   └── styles.css
│       └── package.json
├── supabase/
│   └── schema.sql
├── package.json             # Workspace root
├── pnpm-workspace.yaml
└── vercel.json
```

## Schemat Bazy Danych (Supabase)

```sql
-- Restaurants
CREATE TABLE restaurants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,        -- 2-4 literowy skrót (np. "BF")
  website TEXT,                      -- URL strony (używany jako CTA w reklamach)
  area TEXT NOT NULL,                -- S-CITY | M-CITY | L-CITY
  fame TEXT DEFAULT 'Neutral',       -- Neutral | Hot | Epic
  delivery_radius_km INTEGER DEFAULT 5,
  budget_priorities JSONB,           -- { Event: 20, Lunch: 20, ... }
  facebook_page_id TEXT NOT NULL,
  instagram_account_id TEXT,         -- Opcjonalne (null = brak IG)
  meta_campaign_id TEXT,             -- ID kampanii w Meta
  location JSONB                     -- { lat, lng, address }
);

-- Ad Set Categories (predefiniowane szablony)
CREATE TABLE ad_set_categories (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,         -- EV_ALL, LU_ONS, PR_DEL_CYK, etc.
  name TEXT NOT NULL,
  parent_category TEXT NOT NULL,     -- Event | Lunch | Promo | Product | Brand | Info
  targeting_template JSONB,          -- { age_min, age_max, genders, interests }
  requires_delivery BOOLEAN DEFAULT FALSE,
  is_event_type BOOLEAN DEFAULT FALSE
);

-- Ad Sets (instancje per restauracja)
CREATE TABLE ad_sets (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id),
  category_id UUID REFERENCES ad_set_categories(id),
  meta_ad_set_id TEXT,               -- ID w Meta
  name TEXT NOT NULL,                -- np. "BF_EV_ALL_01"
  version INTEGER DEFAULT 1,
  ads_count INTEGER DEFAULT 0,       -- Max 50
  status TEXT DEFAULT 'ACTIVE',
  event_identifier TEXT              -- Tylko dla eventów
);

-- Posts (reklamy)
CREATE TABLE posts (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id),
  ad_set_id UUID REFERENCES ad_sets(id),
  meta_post_id TEXT NOT NULL UNIQUE,  -- ID posta na FB
  meta_ad_id TEXT,                    -- ID reklamy w Meta
  meta_creative_id TEXT,
  content TEXT,
  category_code TEXT,                 -- Przypisana kategoria
  event_date DATE,
  promotion_end_date DATE,
  status TEXT DEFAULT 'PENDING'       -- PENDING | ACTIVE | PAUSED | EXPIRED
);

-- Events (unikalne wydarzenia)
CREATE TABLE events (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id),
  ad_set_id UUID REFERENCES ad_sets(id),
  identifier TEXT NOT NULL,           -- np. "walentynki-2026"
  name TEXT NOT NULL,
  event_date DATE NOT NULL,
  UNIQUE(restaurant_id, identifier)
);
```

## Kategorie Ad Setów

| Kod | Nazwa | Typ | Delivery |

|-----|-------|-----|----------|

| EV_ALL | Event > Wszyscy | Event | ❌ |

| EV_FAM | Event > Rodzina | Event | ❌ |

| EV_PAR | Event > Para | Event | ❌ |

| EV_SEN | Event > Senior | Event | ❌ |

| LU_ONS | Lunch > On-site | Lunch | ❌ |

| LU_DEL | Lunch > Delivery | Lunch | ✅ |

| PR_ONS_CYK | Promo > On-site > Cykliczna | Promo | ❌ |

| PR_ONS_JED | Promo > On-site > Jednorazowa | Promo | ❌ |

| PR_DEL_CYK | Promo > Delivery > Cykliczna | Promo | ✅ |

| PR_DEL_JED | Promo > Delivery > Jednorazowa | Promo | ✅ |

| PD_ONS | Product > On-site | Product | ❌ |

| PD_DEL | Product > Delivery | Product | ✅ |

| BRAND | Brand | Brand | ❌ |

| INFO | Info | Info | ❌ |

## Flow Przetwarzania Postów

```
1. POST na webhook (lub ręczne dodanie)
   ↓
2. Walidacja (Post ID, treść, restauracja ma kampanię?)
   ↓
3. [KROK 1] Tworzenie Creative w Meta (sprawdza czy post może być promowany)
   ↓ (jeśli błąd → przerwij, nie twórz ad setu)
4. [KROK 2] Kategoryzacja LLM (OpenRouter/Claude)
   → category, event_date, event_identifier, promotion_end_date
   ↓
5. [KROK 3] Znajdź lub stwórz Ad Set
   - Dla eventów: szukaj po event_identifier
   - Dla innych: szukaj wolny ad set (ads_count < 50)
   - Jeśli brak: stwórz nowy (z targetingiem z szablonu kategorii)
   ↓
6. [KROK 4] Tworzenie Reklamy w Meta
   ↓
7. [KROK 5] Zapis do bazy (status: ACTIVE)
```

## Meta API Service

### Kampanie

- **Cel**: `OUTCOME_TRAFFIC` (nie wymaga pixela!)
- **Optymalizacja**: `LINK_CLICKS`
- **Payer**: `JETLABS SP Z O O` (DSA compliance)

### Tworzenie Creative

```typescript
createCreative({
  pageId: string,
  postId: string,
  websiteUrl?: string  // Dodaje CTA "LEARN_MORE" z linkiem
})
```

### Targeting

```typescript
buildTargeting({
  lat, lng, radiusKm,      // Lokalizacja restauracji
  ageMin, ageMax,          // Z szablonu kategorii (default: 18-65)
  genders,                 // [] = wszyscy, [1] = M, [2] = K
  interests,               // [{ id, name }] z Meta
  includeInstagram         // true jeśli restauracja ma IG
})
```

### Dostępne metody

- `createCampaign(restaurantName)` → campaign_id
- `createAdSet({ campaignId, name, targeting, dailyBudget, beneficiary, pageId })` → adset_id
- `createCreative({ pageId, postId, websiteUrl })` → creative_id
- `createAd({ adSetId, creativeId, name })` → ad_id
- `updateAdStatus(adId, 'ACTIVE' | 'PAUSED')`
- `deleteAdSet(adSetId)` → usuwa z Meta
- `deleteAd(adId)` → usuwa z Meta

## LLM Service (OpenRouter)

**Model**: `anthropic/claude-3-haiku`

**Prompt**:

```
Jesteś ekspertem od kategoryzacji postów restauracji dla kampanii reklamowych.

Analizujesz post i wyciągasz:
1. category - jedna z kategorii: EV_ALL, EV_FAM, EV_PAR, EV_SEN, LU_ONS, LU_DEL, 
   PR_ONS_CYK, PR_ONS_JED, PR_DEL_CYK, PR_DEL_JED, PD_ONS, PD_DEL, BRAND, INFO

2. event_date - data wydarzenia (YYYY-MM-DD), tylko dla EV_*

3. event_identifier - unikalny slug wydarzenia (np. "walentynki-2026"), tylko dla EV_*

4. promotion_end_date - sugerowana data końca promocji:
   - Dla wydarzeń: data wydarzenia
   - Dla promocji jednorazowych: max 14 dni
   - Dla promocji cyklicznych: max 60 dni
   - Dla produktów/brand/info: max 30 dni

Odpowiedz TYLKO jako JSON.
```

## UI (React)

### 1. Dashboard

- Statystyki: restauracje, ad sety, reklamy, aktywne
- Tabela restauracji z akcjami (usuń, utwórz kampanię)

### 2. Restauracje

- Formularz dodawania restauracji
- Pola: nazwa, kod, website, region, fame, FB Page ID, IG (opcjonalne), lokalizacja

### 3. Ad Sety

- **Szablony kategorii** - edycja targetowania per kategoria:
        - Wiek (min/max)
        - Płeć (M/K/wszyscy)
        - Zainteresowania (lista checkboxów z predefiniowanymi)
- **Lista aktywnych ad setów** - z filtrem po restauracji
- Przycisk usuwania (usuwa z Meta + bazy)

### 4. Wydarzenia

- Lista wydarzeń z podziałem na nadchodzące/przeszłe
- Kolumny: restauracja, nazwa, identyfikator, data, ad set, liczba reklam
- Filtr po restauracji

### 5. Reklamy (Posty)

- Formularz ręcznego dodawania (restauracja, Post ID, treść)
- Lista reklam z filtrem po restauracji
- Kolumny: restauracja, Post ID, kategoria, Ad Set, status, data końca
- Akcje: Pauza/Włącz, Usuń (usuwa z Meta + bazy), Ponów (dla PENDING)

## Predefiniowane Zainteresowania Meta

```typescript
const RESTAURANT_INTERESTS = [
  { id: '6003384248805', name: 'Jedzenie' },
  { id: '6003107902433', name: 'Restauracje' },
  { id: '6003139266461', name: 'Fast food' },
  { id: '6003348604980', name: 'Fine dining' },
  { id: '6003295028191', name: 'Pizza' },
  { id: '6003327847662', name: 'Kawa' },
  { id: '6003629569625', name: 'Wino' },
  { id: '6003548707756', name: 'Piwo' },
  { id: '6003020834693', name: 'Kuchnia włoska' },
  { id: '6003268718254', name: 'Kuchnia azjatycka' },
  { id: '6003277229969', name: 'Gotowanie' },
  { id: '6003397425735', name: 'Zdrowe odżywianie' },
  { id: '6003012317397', name: 'Weganizm' },
  { id: '6003476182657', name: 'Rodzina' },
  { id: '6003305057498', name: 'Rodzicielstwo' },
  { id: '6003139892773', name: 'Randki' },
  { id: '6003384235085', name: 'Życie nocne' },
  { id: '6003107408097', name: 'Podróże' },
  { id: '6003349442805', name: 'Zakupy i moda' },
];
```

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

# Opcjonalne
AGENCY_NAME=JETLABS SP Z O O
```

## API Endpoints

### Restaurants

- `GET /api/restaurants` - lista
- `POST /api/restaurants` - dodaj
- `PUT /api/restaurants/:id` - edytuj
- `DELETE /api/restaurants/:id` - usuń
- `POST /api/restaurants/:id/retry-campaign` - ponów tworzenie kampanii

### Ad Sets

- `GET /api/ad-sets` - lista ad setów
- `GET /api/ad-sets/categories` - lista kategorii
- `PUT /api/ad-sets/categories/:id` - edytuj kategorię (targeting)
- `GET /api/ad-sets/events` - lista wydarzeń
- `DELETE /api/ad-sets/:id` - usuń ad set (+ z Meta)

### Posts

- `GET /api/posts` - lista
- `POST /api/posts/manual` - dodaj ręcznie
- `POST /api/posts/:id/pause` - wstrzymaj reklamę
- `POST /api/posts/:id/activate` - włącz reklamę
- `POST /api/posts/:id/retry` - ponów przetwarzanie
- `DELETE /api/posts/:id` - usuń (+ z Meta)

### Webhook

- `POST /api/webhook/ayrshare` - webhook z Ayrshare

### Scheduler

- `POST /api/scheduler/expire-posts` - ręczne wygasanie postów

## Deployment (Vercel)

```json
// vercel.json
{
  "builds": [
    { "src": "packages/api/dist/main.js", "use": "@vercel/node" },
    { "src": "packages/app/package.json", "use": "@vercel/static-build" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "packages/api/dist/main.js" },
    { "src": "/(.*)", "dest": "packages/app/$1" }
  ],
  "crons": [
    { "path": "/api/scheduler/expire-posts", "schedule": "0 0 * * *" }
  ]
}
```

## Kluczowe Decyzje Techniczne

1. **TRAFFIC bez pixela**: Używamy `OUTCOME_TRAFFIC` + `LINK_CLICKS` zamiast conversions - nie wymaga Meta Pixela
2. **Website jako CTA**: Link do strony restauracji dodawany jako Call to Action "LEARN_MORE"
3. **Kolejność tworzenia**: Creative PRZED Ad Setem - jeśli post nie może być promowany, nie tworzymy niepotrzebnego ad setu
4. **Idempotencja**: `meta_post_id` jest UNIQUE - zapobiega duplikatom
5. **Event isolation**: Każdy event (po `event_identifier`) = osobny ad set
6. **50 ads limit**: Automatyczne tworzenie nowej wersji ad setu gdy limit
7. **DSA compliance**: `dsa_beneficiary` = nazwa restauracji, `dsa_payor` = JETLABS SP Z O O
8. **Instagram opcjonalny**: Targeting zawiera IG tylko jeśli restauracja ma `instagram_account_id`
9. **Targeting z szablonów**: Każda kategoria ma edytowalny szablon (wiek, płeć, zainteresowania)
10. **Usuwanie kaskadowe**: Usunięcie ad setu usuwa też reklamy z Meta i z bazy