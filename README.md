# DGkart.com

Marketplace shopping app for **DGkart** (DGkart.com): a Flutter app for Android (Play Store), iOS and web, backed by a NestJS + PostgreSQL REST API.

| Folder | What it is |
| --- | --- |
| [`mobile/`](mobile) | Flutter app: phone OTP login, home/deals, search with filters, product page, watchlist, cart, checkout (Razorpay / COD), orders, admin panel |
| [`backend/`](backend) | REST API (`/api/v1`, OpenAPI docs at `/docs`): auth, catalogue, cart, orders, payments, bulk Excel import, image upload, demo data |
| [`docs/`](docs) | Setup, architecture, Excel import guide, Play Store release checklist, store graphics |

## Try it on a phone (no setup)

Download **[dgkart-demo.apk](https://github.com/ugoyel/dgkart/releases/download/demo/dgkart-demo.apk)** on an Android phone and open it (allow "install unknown apps" when asked). This offline demo runs entirely on the phone with 499 sample products: sign in with any number and OTP `123456` (use 9910123503 for the admin panel); payments are simulated and nothing is saved after the app closes. It is rebuilt by the *Demo APK* workflow on every push.

Build it yourself with `flutter build apk --dart-define=DEMO_MODE=true`; regenerate its catalogue with `node mobile/tool/build_demo_data.mjs` while the API is running.

## Quick start (local, no accounts needed)

```bash
# 1. API + Postgres (seeds 1,000 demo products on first start)
docker compose up --build            # http://localhost:3000/docs

# 2. App (Android emulator reaches your PC at 10.0.2.2)
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

Local mode uses a **test OTP (`123456`)** and a **simulated payment sheet**, so everything works before you create Firebase or Razorpay accounts. Sign in with **9910123503** to get the admin panel; every other number is a regular shopper.

## Going live

1. [docs/SETUP.md](docs/SETUP.md): Firebase phone OTP, Razorpay keys, deploying the API and image storage.
2. [docs/PLAY_STORE.md](docs/PLAY_STORE.md): signing key, building the `.aab`, Play Console listing, data safety, testing track.
3. [docs/IMPORT_GUIDE.md](docs/IMPORT_GUIDE.md): Excel product sheet, image mapping sheet and bulk image upload.
4. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the layers fit together and how to swap technologies or add the website.
