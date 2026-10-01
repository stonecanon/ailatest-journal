# Android signing key inventory

Last verified: 2026-08-11

## Current Google Play upload key

- Play Console expected SHA1: `2C:9C:90:BE:FD:F5:58:1B:AA:28:FD:93:1A:72:E5:7A:36:EE:E5:71`
- Keystore: `/Users/zhizhi/同步盘/AI 工作区/00_每日更新/ailatest-journal/android/ailatest-upload.jks`
- Alias: `ailatest_upload`
- Keychain service: `AILatest Android Play upload keystore password (2C)`
- Keychain account: `ailatest-upload-2c`

This is the key accepted by the current Play Console application as of the last successful upload of version code 6 (`0.1.5`).

## Previous internal-test upload key

- SHA1: `2F:DC:58:C8:5A:BF:6A:14:A7:23:1A:45:DB:17:22:B7:2D:9B:84:3E`
- Keystore: `/Users/zhizhi/.config/ailatest/play-upload.jks`
- Alias: `ailatest-upload`
- Keychain store-password service: `AILatest Android Play upload keystore password`
- Keychain store-password account: `ailatest-upload-store`
- Keychain key-password service: `AILatest Android Play upload key password`
- Keychain key-password account: `ailatest-upload-key`

This key signed the earlier internal-test bundle. Keep it archived; do not delete it.

## Build safety rule

Before every upload, compare the SHA1 requested by Play Console with the AAB certificate using:

```sh
keytool -printcert -jarfile app-release.aab
```

Never put keystore passwords in this file or commit a `.jks` file to Git.
