# AILatest Journal Android

Native Kotlin + Jetpack Compose client for `journal.ailatest.org`.

The app deliberately uses the existing Worker API instead of bundling another
copy of the journal catalogue. Search and journal details therefore follow the
same data updates as the website. Login, cloud favorites, AI recommendation
quota, and entitlements use the same account and server-side rules.

## Local build

Requires JDK 17, Android SDK 36, and Gradle 8.9+ (or Android Studio Ladybug+).

```bash
cd android
gradle assembleDebug
```

The package name is `org.ailatest.journal`. The Google OAuth callback uses the
private app scheme `ailatest://oauth`.

## Play products

The client expects two Google Play subscription products:

- `ailatest_pro` with base plans `monthly` and `yearly`
- `ailatest_max` with base plans `monthly` and `yearly`

The UI displays the localized prices returned by Play Billing. It does not
hardcode the website/Creem price inside the Play checkout flow.

Purchase tokens are sent to `POST /play/purchases/verify` (the Worker also
accepts the same route under `/api`). The Worker
verifies them with Google Play Developer API, acknowledges them, and writes the
existing `user_entitlements` record, so a Play purchase immediately unlocks the
same Pro/Max features on the website after signing in to the same account.

Production service-account and RTDN setup is documented in
`../docs/ANDROID_GOOGLE_PLAY.md`.
