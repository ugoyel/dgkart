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

## Website

`web/` is a React + Vite site on the same API. Its data layer is a `DataSource` interface with two adapters. `ApiDataSource` calls `/api/v1`. `DemoDataSource` runs the app's sample catalogue in the browser, so the site can be hosted and shown before the API is live. Pages depend only on the interface.

The Flutter app still builds for web too (`flutter build web`), but `web/` is the shopper-facing website.

## Festivals and offers

`backend/src/modules/promotions/engine/` is plain TypeScript with no framework imports. It holds:

- the festival calendar and theme resolution
- reminder scheduling
- draft offer generation
- cart pricing (quote)

The API's `PromotionsModule` and the website both import it, so the prices shown in the browser are the same prices the API charges.

- **Storage:** offers live in the `promotions` table. Admin edits to the calendar and dismissed reminders are stored in `app_settings`.
- **Orders:** an order stores the offers applied to it in `discounts`. Lightning deal units and coupon uses are claimed when the order is placed and released when it is cancelled or the payment fails.
- **Endpoints:**
  - public: `GET /promotions`, `POST /promotions/quote`
  - admin: `/admin/offers`, `/admin/festivals`, `/admin/notifications`
- **The Android app:** it does not show deals yet, but server-side deals already apply to its orders.
- **Database changes:** the new columns (`orders.discount`, `orders.discounts`) and tables are created by `DB_SYNC` in development. Add a migration before production.
