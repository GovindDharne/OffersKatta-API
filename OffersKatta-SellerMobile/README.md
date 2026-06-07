# OffersKatta Seller Mobile

Flutter app for sellers (brand owners, business managers, staff) of [OffersKatta](https://github.com/GovindDharne/OffersKatta) — manage brands, branches, offers, the team, run subscriptions and offer-boost payments, and scan customer redemption QRs at the counter. Mirrors the `/seller/*` section of the admin panel at `admin.offerskatta.com`.

> **About this repo** — this is the standalone repo split from the monorepo. The Flutter project is at the repo root (not under `apps/mobile-seller/`). The platform folders (`android/`, `ios/`) are already generated; do **not** run `flutter create` — that would overwrite them.

## Architecture

Same pattern as `apps/mobile-customer`:

- **State**: `flutter_riverpod`
- **Networking**: `dio` with an auth interceptor that injects the bearer token
  and silently refreshes on 401.
- **Routing**: `go_router` with a redirect guard backed by the auth state.
- **Persistence**: `flutter_secure_storage` for tokens + cached user.
- **Layers**: each feature follows Clean Architecture
  (`domain/entities`, `domain/repositories`, `data/datasources`, `data/repositories`,
  `presentation/providers`, `presentation/screens`).

## Role gate

Only the following backend roles are allowed to use this app:

- `SELLER_OWNER`
- `BUSINESS_MANAGER`
- `STAFF`
- `SUPER_ADMIN`

A `CUSTOMER` who tries to log in is rejected with a friendly message
asking them to use the consumer app instead. Enforced in
`AuthRepositoryImpl.login()` and re-checked on every app boot via
`/users/me`.

## Features

| Section | Capability |
| --- | --- |
| **Login** | Email + password. Role gate rejects `CUSTOMER` accounts at the API + UI level. |
| **Dashboard** | User card, quick links to each section, "Manage on the website" tiles for payments. |
| **Brands** | List my brands, create/edit (name, type, description, contact, website), archive. |
| **Branches** | Brand picker → list branches, create/edit (address, city/state/PIN, lat/lng, status), archive. |
| **Offers** | Brand picker → list offers, create/edit full form: branch, title, description, type, discount, max/min, coupon, dates, status, tags, **multiple images** (`image_picker` → multipart upload), **list thumbnail**, **card offers** (bank dropdown → card dropdown → add → benefit fields), online platforms. |
| **Team** | Brand picker → list invitations, send new invitation (email + role). |

## Payments

The seller app **embeds the Razorpay Flutter SDK** (`razorpay_flutter`) and runs both **Subscription** and **Offer boost** checkouts inline:

- **Subscription** — `lib/src/features/subscription/...` — full plan picker (Free/Premium/Featured/Enterprise), monthly/yearly toggle, Razorpay Checkout, signature verification, payment history. Enterprise plan opens a Contact Sales bottom sheet that posts to `/api/enterprise/leads`.
- **Boost an offer** — `lib/src/features/offers/.../boost_sheet.dart` — duration picker (7/15/30 days), Razorpay Checkout, server-side signature verification, offer flips to featured.

Razorpay keys come from the backend via `GET /api/payments/config`. If keys aren't configured server-side, both flows show a friendly "Online payments aren't configured yet" banner and the rest of the app works fine.

## Redemptions

Sellers can scan customer-generated QRs at the counter and confirm redemptions:

- **Dashboard → Scan customer QR** opens the camera (`mobile_scanner`). Detected QR → confirm bottom sheet → optionally enter final bill amount and notes → `POST /api/redemptions/:qr/confirm` → success card with offer + customer details. Camera resumes for the next scan.
- **Dashboard → Redemptions** lists per-branch redemption history with summary counters (Today, Redeemed, Pending, Sales).

## Run

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2/api \
            --dart-define=PANEL_URL=http://admin.offerskatta.com
```

For a physical device, replace `10.0.2.2` with your machine's LAN IP and make sure the API container is reachable from the device.

The compiled-in default for `API_BASE_URL` lives in `lib/src/core/constants/api_constants.dart` — update it when the dev backend's address changes, or override via `--dart-define` on every run.

### Firebase setup (optional, for FCM push)

`google-services.json` (Android) and `GoogleService-Info.plist` (iOS) are not committed to this repo. To enable push notifications, drop them in from your Firebase Console:

- Android: `android/app/google-services.json` (package: `com.offerskatta.offerskatta_seller`)
- iOS: `ios/Runner/GoogleService-Info.plist`

Both are gitignored. Without them push silently no-ops; the rest of the app runs fine.

### Camera permission (for redemption-QR scanning)

Already declared in `android/app/src/main/AndroidManifest.xml`. On first scan, Android prompts the user; on iOS, ensure the camera-usage description is set in `ios/Runner/Info.plist`.

## Default seeded credentials

| Role | Email | Password |
| --- | --- | --- |
| Super admin  | `admin@offerhub.local`             | `Admin@12345` |
| Seller owner | `owner@abc-restaurant.local`       | `Owner@12345` |
| Seller owner | `owner@sunrise-hotels.local`       | `Owner@12345` |
| Seller owner | `owner@urbancart.local`            | `Owner@12345` |
| Seller owner | `owner@glamsalon.local`            | `Owner@12345` |

> The seed data still uses the `offerhub.local` domain from before the
> rebrand. The customer-facing brand is OffersKatta but the seeded
> usernames weren't migrated — they're stable test fixtures.

## Build

```bash
flutter build apk --release \
  --dart-define=API_BASE_URL=https://api.offerskatta.com/api \
  --dart-define=PANEL_URL=https://admin.offerskatta.com
```
