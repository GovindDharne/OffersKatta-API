# OffersKatta Customer Mobile

Customer mobile client for [OffersKatta](https://github.com/GovindDharne/OffersKatta) — Android + iOS Flutter app. Talks to the shared OffersKatta API.

> **About this repo** — this is the standalone repo split from the monorepo. The Flutter project is at the repo root (not under `apps/mobile-customer/`). The platform folders (`android/`, `ios/`) are already generated; do **not** run `flutter create .` — that would overwrite them.

## Stack

- **Flutter** 3.22+
- **Riverpod 2** for state
- **Dio 5** for HTTP (+ auth interceptor with refresh-token rotation)
- **GoRouter 14** for navigation
- **flutter_secure_storage** for tokens
- **Clean Architecture** (presentation → domain ↔ data)
- **Repository pattern** with feature-scoped use cases

## Prerequisites

- Flutter SDK 3.22+ on PATH (`flutter --version`)
- Android Studio or Xcode for device builds
- The OffersKatta backend running (default: `http://localhost/api` via Nginx)

## Setup

```bash
flutter pub get
```

Platform folders are already generated and the permissions below are already declared in the manifest / Info.plist. Documented here for reference:

**Android** — `android/app/src/main/AndroidManifest.xml` (inside `<manifest>`, before `<application>`):
```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
```

For Android 9+ cleartext HTTP (dev only — pointing to `http://10.0.2.2/api`):
add `android:usesCleartextTraffic="true"` to `<application>`.

**iOS** — `ios/Runner/Info.plist`:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>OffersKatta uses your location to show nearby deals.</string>
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key><true/> <!-- dev only -->
</dict>
```

## Run

```bash
# Choose the API base URL for your platform:
#   Android emulator → 10.0.2.2 maps to host machine
#   iOS simulator    → localhost works
#   Physical device  → use your host LAN IP

flutter run --dart-define=API_BASE_URL=http://10.0.2.2/api          # Android emulator
flutter run --dart-define=API_BASE_URL=http://localhost/api          # iOS simulator
flutter run --dart-define=API_BASE_URL=http://192.168.1.42/api       # physical device
```

The compiled-in default sits in `lib/src/core/constants/api_constants.dart` — update it when the dev backend's address changes, or override via `--dart-define` on every run.

## Layout

```
lib/
  main.dart
  src/
    app/                          # Root MaterialApp + ProviderScope
    router/                       # GoRouter + auth gate
    core/
      constants/                  # API constants
      di/                         # Provider definitions for shared infrastructure
      error/                      # Failure / exception types
      network/                    # Dio client + interceptors + envelope
      theme/                      # Material 3 theme (light/dark)
      utils/                      # Formatters, geo helpers
    features/
      auth/         { domain, data, presentation }
      offers/       { domain, data, presentation }
      favorites/    { domain, data, presentation }
      redemptions/  { domain, data, presentation }
      notifications/{ domain, data, presentation }
      profile/      { presentation }
      shell/        # Bottom-nav scaffold
```

**Each feature** is split into:
- `domain/` — Pure Dart entities, repository abstractions, use cases. No Flutter or Dio imports.
- `data/` — DTO models, remote/local data sources, repository implementations.
- `presentation/` — Riverpod providers/controllers and screens.

## Default seeded credentials (from the API seeder)

| Role | Email | Password |
| --- | --- | --- |
| Customer | `customer1@offerhub.local` | `Owner@12345` |
| Customer | `customer2@offerhub.local` | `Owner@12345` |
| Customer | `customer3@offerhub.local` | `Owner@12345` |

Or register a fresh customer from the Sign-up screen.

## Build

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://api.offerskatta.com/api
flutter build ipa --release --dart-define=API_BASE_URL=https://api.offerskatta.com/api
```

## Push notifications (FCM) — one-time Firebase setup

The customer app registers its FCM token with `POST /api/customers/me/devices`
on every login + bootstrap, listens for `onTokenRefresh`, and unregisters on
logout. Foreground messages are exposed via `PushService.foregroundMessages`
for the UI to surface as in-app banners. **All of this is gated on Firebase
being available — without the config files below, the service silently
no-ops and the app keeps working.**

To enable real push:

1. Create a Firebase project in the [console](https://console.firebase.google.com/)
   and add an Android app with package `com.offerskatta.offerskatta_customer`
   (and an iOS app with the matching bundle id if you ship to App Store).
2. Download `google-services.json` → drop into `android/app/`.
3. Download `GoogleService-Info.plist` → drop into `ios/Runner/`.
4. Add the Gradle plugin in `android/build.gradle.kts`:
   `classpath("com.google.gms:google-services:4.4.2")` and
   `apply(plugin = "com.google.gms.google-services")` in `android/app/build.gradle.kts`.
5. Rebuild. On first launch you'll see the OS permission prompt; on grant,
   the device's token is POSTed to the API.

Backend half (the API doing the actual `messaging().send()`) is already wired
in `apps/api/src/modules/firebase` — see the api README for the three env
vars (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)
from the same service-account JSON.

## Location updates

`LocationService.captureAndSend()` runs on every authenticated bootstrap
(throttled to once/hour). It requests location permission via geolocator,
takes a single `medium`-accuracy fix, and PATCHes
`/api/customers/me/location`. This powers the radius-based push targeting on
the server side. No background tracking — the app is in-foreground only.

## Brand follow

The offer detail screen shows a **Follow / Following** button under the
brand name (only for logged-in customers). Tapping it hits
`POST /api/brands/:id/follow` (or `DELETE` to unfollow). Following a brand
delivers push for new offers regardless of distance from the brand's
branches, alongside the radius-targeted "near you" pushes.

## Next steps (not yet in customer mobile)

- "My follows" screen — list every brand the user follows
- "Notification settings" — toggle `notifyEnabled` + tune `notificationRadiusKm`
- Background location updates via `flutter_background_geolocation` (optional)
- Image uploads via Cloudinary signed presets (endpoint: `POST /api/uploads/sign`)
