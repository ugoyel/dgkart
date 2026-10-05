# Setup: from local demo to live

Everything runs locally with no accounts (test OTP `123456`, simulated payments). This guide switches each piece to real services.

## 1. Run locally

**With Docker:** `docker compose up --build` in the repo root. API at http://localhost:3000, docs at http://localhost:3000/docs.

**Without Docker:** install Node 22 and PostgreSQL 16, then

```bash
cd backend
cp .env.example .env            # edit DATABASE_URL if needed
npm install
npm run start:dev               # creates tables, seeds 1,000 demo products on first run
node test/smoke.mjs             # optional: 27 end-to-end checks against the running API
```

**App:** install Flutter (stable), then

```bash
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000     # Android emulator
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3000   # web
```

On a real phone use your PC's LAN IP, e.g. `http://192.168.1.20:3000`.

## 2. Real SMS OTP with Firebase Phone Auth

1. Create a project at https://console.firebase.google.com.
2. **Authentication → Sign-in method → Phone → Enable.**
   Firebase gives a free monthly allowance of SMS verifications, but Google may ask you to switch the project to the pay-as-you-go **Blaze** plan before SMS is sent; check current pricing in the console. **Test phone numbers** (Authentication → Sign-in method → Phone → "Phone numbers for testing") are always free; add `+91 9910123503` with code `123456` while developing, and a separate one for Google's reviewers (see PLAY_STORE.md).
3. Add an **Android app** with package name `com.dgkart.app`. Add the **SHA-1 and SHA-256** fingerprints of:
   * your debug key: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android`
   * your upload key (PLAY_STORE.md step 1)
   * the **Play App Signing** key (Play Console → Test and release → App integrity), after your first upload.
   Missing fingerprints are the #1 cause of "OTP not received" in release builds.
4. In `mobile/`, run `dart pub global activate flutterfire_cli` then `flutterfire configure --project=<your-project-id>`. This replaces `lib/firebase_options.dart` and writes `android/app/google-services.json` (the Gradle build applies the Google services plugin automatically when that file exists).
5. Backend `.env`: `AUTH_MODE=firebase` and `FIREBASE_PROJECT_ID=<your-project-id>`. No service-account key is needed just to verify sign-in tokens.
6. Build the app with `--dart-define=AUTH_MODE=firebase`.

The admin is whoever signs in with `ADMIN_PHONE` (default `+919910123503`).

## 3. Payments with Razorpay

1. Sign up at https://dashboard.razorpay.com (test mode is free and needs no KYC).
2. **Settings → API Keys → Generate Test Key.** Put them in the backend `.env`:
   ```
   PAYMENT_PROVIDER=razorpay
   RAZORPAY_KEY_ID=rzp_test_xxx
   RAZORPAY_KEY_SECRET=xxx
   ```
3. **Settings → Webhooks → Add:** URL `https://<your-api>/api/v1/payments/webhook/razorpay`, events `payment.captured` and `order.paid`, and a secret, which goes in `RAZORPAY_WEBHOOK_SECRET`. The webhook confirms payments even if the shopper closes the app straight after paying.
4. Test cards / UPI: https://razorpay.com/docs/payments/payments/test-card-details/
5. To take real money, complete Razorpay KYC and switch to **live** keys. No app change is needed; keys live only on the server.

Cash on Delivery works without any gateway.

## 4. Deploy the API

The API is a standard Docker image (`backend/Dockerfile`). Any host works; the important settings are:

| Variable | Production value |
| --- | --- |
| `DATABASE_URL` | Managed Postgres (Neon, Supabase, Render, RDS…) |
| `PUBLIC_BASE_URL` | Public HTTPS URL of the API, e.g. `https://api.dgkart.com` |
| `JWT_SECRET` | Long random string |
| `AUTH_MODE` / `FIREBASE_PROJECT_ID` | `firebase` / your project |
| `PAYMENT_PROVIDER` + Razorpay keys | see above |
| `STORAGE_DRIVER` + `S3_*` | `s3` for product images (below) |
| `SEED_ON_BOOT` | `1000` for a demo store, `0` once you import real products |
| `DB_SYNC` | `true` creates/updates tables automatically. Before you have important data, switch to TypeORM migrations and set `false`. |

`render.yaml` is a ready blueprint for Render (Dashboard → New → Blueprint). Free tiers sleep when idle and free Postgres instances can expire, so use a paid instance (or Neon/Supabase) for the live store.

**Product images:** most free hosts wipe the local disk on every deploy. Use an S3-compatible bucket; Cloudflare R2 has a 10 GB free tier:

```
STORAGE_DRIVER=s3
S3_BUCKET=dgkart-images
S3_REGION=auto
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_URL=https://pub-xxxx.r2.dev        # or your custom image domain
```

## 5. Point the app at production

```bash
flutter build appbundle --release \
  --dart-define=API_BASE_URL=https://api.dgkart.com \
  --dart-define=AUTH_MODE=firebase \
  --dart-define=PRIVACY_POLICY_URL=https://api.dgkart.com/privacy.html \
  --dart-define=SUPPORT_EMAIL=support@dgkart.com
```

## Demo data

The admin panel has **Add demo products** (500 to 10,000 at a time), **Remove all demo products** (keeps your imported products) and **Delete entire catalogue**. Demo images come from picsum.photos (free placeholder photos).
