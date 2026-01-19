# Meta Ads Autopilot

Automatyczny system zarządzania reklamami Meta Ads dla restauracji.

## Funkcjonalności

- **Zarządzanie restauracjami** - jedna kampania = jedna restauracja
- **Automatyczna kategoryzacja postów** - LLM analizuje treść i przypisuje do odpowiedniej kategorii
- **Automatyczne tworzenie ad setów** - gdy post nie pasuje do istniejącego ad setu
- **Limit 50 reklam per ad set** - automatyczne tworzenie nowej wersji
- **Obsługa wydarzeń** - każde wydarzenie ma osobny ad set
- **Wygaszanie promocji** - codzienne automatyczne wyłączanie przeterminowanych reklam

## Tech Stack

- **API**: NestJS
- **Frontend**: React + Vite
- **Database**: Supabase (PostgreSQL)
- **LLM**: OpenRouter (Claude Haiku)
- **Hosting**: Vercel

## Struktura projektu

```
meta-ads-autopilot/
├── packages/
│   ├── api/          # NestJS API
│   └── app/          # React Frontend
├── supabase/
│   └── schema.sql    # Database schema
└── vercel.json       # Deployment config
```

## Setup

### 1. Baza danych (Supabase)

1. Utwórz projekt w [Supabase](https://supabase.com)
2. Uruchom `supabase/schema.sql` w SQL Editor
3. Skopiuj `SUPABASE_URL` i `SUPABASE_SERVICE_KEY`

### 2. Meta Ads

1. Utwórz aplikację w [Meta for Developers](https://developers.facebook.com)
2. Dodaj uprawnienia:
   - `ads_management`
   - `pages_read_engagement`
   - `business_management`
3. Wygeneruj access token
4. Pobierz `META_AD_ACCOUNT_ID` z Business Manager

### 3. OpenRouter

1. Zarejestruj się na [OpenRouter](https://openrouter.ai)
2. Skopiuj API key

### 4. Zmienne środowiskowe

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# Meta Ads
META_ACCESS_TOKEN=EAAx...
META_AD_ACCOUNT_ID=1234567890

# OpenRouter
OPENROUTER_API_KEY=sk-or-...

# Webhook (opcjonalne)
WEBHOOK_SECRET=your-secret

# Agency
AGENCY_NAME=TwojaAgencja
```

### 5. Lokalny development

```bash
# Instalacja
pnpm install

# API (port 3001)
pnpm dev:api

# Frontend (port 3000)
pnpm dev:app
```

### 6. Deploy na Vercel

```bash
vercel
```

## Webhook

### Endpoint
```
POST /api/webhook/ayrshare
```

### Headers
```
x-webhook-secret: your-secret (opcjonalne)
```

### Payload (Ayrshare format)
```json
{
  "post": {
    "postIds": [
      {
        "platform": "facebook",
        "postId": "122110386309149400"
      }
    ],
    "post": "Treść posta..."
  },
  "refId": "facebook_page_id"
}
```

## Konwencja nazewnictwa

### Kampanie
```
{restaurant_name}
```

### Ad Sets
```
{restaurant_code}_{category}_{version}
```
Przykład: `BF_EV_ALL_01`

### Reklamy
```
{ad_set_name}_{post_id_last6}_{DDMMYY}
```
Przykład: `BF_EV_ALL_01_149400_120126`

## Kategorie Ad Setów

| Kod | Nazwa | Typ |
|-----|-------|-----|
| EV_ALL | Event > Wszyscy | Event |
| EV_FAM | Event > Rodzina | Event |
| EV_PAR | Event > Para | Event |
| EV_SEN | Event > Senior | Event |
| LU_ONS | Lunch > On-site | Lunch |
| LU_DEL | Lunch > Delivery | Lunch |
| PR_ONS_CYK | Promo > On-site > Cykliczna | Promo |
| PR_ONS_JED | Promo > On-site > Jednorazowa | Promo |
| PR_DEL_CYK | Promo > Delivery > Cykliczna | Promo |
| PR_DEL_JED | Promo > Delivery > Jednorazowa | Promo |
| PD_ONS | Product > On-site | Product |
| PD_DEL | Product > Delivery | Product |
| BRAND | Brand | Brand |
| INFO | Info | Info |

## API Endpoints

### Restaurants
- `GET /api/restaurants` - lista restauracji
- `GET /api/restaurants/:id` - szczegóły restauracji
- `POST /api/restaurants` - dodaj restaurację
- `PUT /api/restaurants/:id` - aktualizuj restaurację

### Ad Sets
- `GET /api/ad-sets` - lista ad setów
- `GET /api/ad-sets/categories` - lista kategorii
- `PUT /api/ad-sets/categories/:id` - aktualizuj kategorię

### Posts
- `GET /api/posts` - lista postów
- `POST /api/posts/:id/pause` - wstrzymaj reklamę
- `POST /api/posts/:id/activate` - aktywuj reklamę

### Scheduler
- `POST /api/scheduler/expire-posts` - wygaś przeterminowane posty

## License

MIT
