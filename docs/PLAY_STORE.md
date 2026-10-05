# Publishing DGkart on Google Play

App id: **`com.dgkart.app`** · App name on device: **DGkart** · Version: `mobile/pubspec.yaml` → `version: 1.0.0+1` (bump the `+N` build number for every upload).

## 1. Create your upload key (once, keep it safe)

```bash
keytool -genkey -v -keystore ~/dgkart-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Create `mobile/android/key.properties` (git-ignored, never commit it):

```
storePassword=<password>
keyPassword=<password>
keyAlias=upload
storeFile=/Users/you/dgkart-upload.jks
```

Back up the `.jks` and passwords. With Play App Signing (default) a lost upload key can be reset through Play support, but it takes days.

## 2. Build the release bundle

```bash
cd mobile
flutter build appbundle --release \
  --dart-define=API_BASE_URL=https://<your-api-domain> \
  --dart-define=AUTH_MODE=firebase \
  --dart-define=PRIVACY_POLICY_URL=https://<your-api-domain>/privacy.html \
  --dart-define=SUPPORT_EMAIL=<support email>
# → build/app/outputs/bundle/release/app-release.aab
```

Release builds are minified (R8) with Razorpay keep rules in `android/app/proguard-rules.pro`. If `key.properties` is missing the bundle is debug-signed and Play will reject it.

Before uploading, install a release build on a real phone and test sign-in, an order with Razorpay test mode, and the admin import: `flutter build apk --release ...same defines...` then `adb install build/app/outputs/flutter-apk/app-release.apk`.

## 3. Play Console checklist

1. **Create app** at https://play.google.com/console (one-time US$25 developer fee). Name: DGkart, default language English (India), App, Free.
2. **Testing requirement:** new *personal* developer accounts must run a **closed test with at least 12 testers for 14 continuous days** before production access is granted. Organisation accounts (needs a D-U-N-S number) are exempt.
3. **Store listing** (graphics are in [`docs/play-store/`](play-store)):
   * App icon 512×512: `icon-512.png`
   * Feature graphic 1024×500: `feature-graphic-1024x500.png`
   * 2 to 8 phone screenshots: take them from your device after importing real products
   * Short description (80 chars), e.g. "Shop deals on electronics, fashion, home & more. Pay by UPI, card or COD."
4. **Privacy policy URL:** `https://<your-api-domain>/privacy.html`. Fill in the [bracketed] fields in `backend/public/privacy.html` first.
5. **App access:** sign-in is required, so give reviewers a login. Add a Firebase test number (e.g. `+91 9999999999`, code `123456`) and enter it under *App content → App access* with the steps "Enter 9999999999, tap Continue, enter 123456".
6. **Account deletion:** in-app at *My DGkart → Delete account*; web link `https://<your-api-domain>/delete-account.html` (edit the email in `backend/public/delete-account.html`).
7. **Data safety** (answers matching this code):

   | Data | Collected | Shared | Purpose | Optional |
   | --- | --- | --- | --- | --- |
   | Phone number | Yes | Yes (Firebase, delivery partner) | Account management, app functionality | No |
   | Name, email | Yes | No | Account management | Yes |
   | Address | Yes | Yes (delivery partner) | App functionality | No |
   | Purchase history | Yes | No | App functionality | No |
   | Payment info | No (handled by Razorpay) | — | — | — |

   Data is encrypted in transit: Yes. Users can request deletion: Yes.
8. **Content rating** questionnaire: shopping app, no user-generated content; typically rated Everyone / 3+.
9. **Target audience:** 18+. **Ads:** No. **News app:** No. **Government app:** No. **Financial features:** none (payments go through Razorpay).
10. Upload `app-release.aab` to **Closed testing**, add testers, then promote to **Production** when eligible.
11. After the first upload, copy the **App signing key SHA-1/SHA-256** (Test and release → App integrity) into Firebase (SETUP.md §2), or OTP will fail for Play-installed builds.

## What still needs you

* A live HTTPS API (SETUP.md §4); the app can't reach `localhost` from the store.
* Firebase project + `flutterfire configure`, Razorpay keys, privacy policy details, support email.
* Real screenshots and your product catalogue.
* Trademark: "DGkart" branding and the generated logo are original; make sure the names are clear for you to use in India.
