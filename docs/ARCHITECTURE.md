# Architecture

```
 Flutter app (Android / iOS / Web)            Future website (any stack)
   presentation → domain ← data                      │
                    │  (repository interfaces)       │
                    └──────────── HTTPS / JSON ──────┘
                                   │
                         NestJS REST API  /api/v1   (OpenAPI: backend/openapi.json)
             auth · users · catalog · cart · watchlist · orders · payments · admin
                    │                     │                         │
              PostgreSQL           StorageService            PaymentGateway
                                (local disk | S3/R2)       (Razorpay | mock)
```

## Principles that make migration easy

* **One API for every client.** The app holds no business rules that the website would need to re-implement: prices, shipping, stock, roles and payment verification all live in the API. The website calls the same endpoints, described by `backend/openapi.json` (regenerate with `npm run openapi`; generate typed clients with any OpenAPI generator).
* **Ports and adapters on both sides.**
  * App: each feature has `domain/` (pure Dart entities + abstract repositories), `data/` (REST implementations), `presentation/` (screens + Riverpod controllers). Replacing REST with GraphQL, Supabase or Firebase means writing new `data/` classes and changing one provider line.
  * API: `StorageService` (local disk or any S3-compatible bucket), `PaymentGateway` (Razorpay or mock), `OtpProvider` on the app (Firebase or dev) and `FirebaseTokenVerifier` on the API. Add MSG91/Twilio OTP, Stripe/PayU/Cashfree, or Cloudinary by adding one class.
  * Background jobs go through `JobRunner.enqueue()`. It runs in-process today; swap it for BullMQ/Redis or SQS when you run several API instances, without touching callers.
* **Configuration only through environment variables** (`backend/.env.example`) and `--dart-define` (`mobile/lib/core/config/app_config.dart`).
* **Plain SQL-friendly schema.** Standard Postgres tables (`users, categories, products, product_images, cart_items, watchlist, orders, import_jobs, image_mappings`), UUID keys, JSONB only for specs/addresses/order snapshots. Moving to another SQL database or ORM is mechanical.

## Large catalogues

* Excel/CSV files are **streamed** row by row (no full workbook in memory) and written in batches of `IMPORT_BATCH_SIZE` (default 500) with `INSERT … ON CONFLICT (sku) DO UPDATE`. Re-importing a sheet updates products instead of duplicating them. Measured locally: 3,000 rows in about 1.5 s.
* Row errors are collected per row (first 200) without stopping the import.
* List endpoints return a slim projection and a denormalised `thumbnailUrl`, paginate 20 at a time, and use B-tree indexes plus `pg_trgm` trigram indexes for text search.
* Images are uploaded from the app in batches of 10 files per request.

## Roles

`ADMIN_PHONE` (default `+919910123503`) is the admin; the role is recalculated on every login, so changing the variable takes effect immediately. Everyone else is `USER`. Admin endpoints are under `/api/v1/admin/*` and guarded server-side; the app only hides the UI.

## Website later

The Flutter code already builds for web (`flutter build web`) with responsive layouts: bottom tabs become a side rail at ≥ 900 px, grids grow from 2 to 6 columns and content is capped at 1280 px. Routes are URL-shaped (`/product/:id`, `/search/results?q=`), so they map directly to web URLs. You can ship the Flutter web build as the website, or build a separate Next.js/React site on the same API and design tokens (`mobile/lib/core/theme/app_theme.dart`).
