# BGTS-OS — React Native (Expo) v1.0

Baroda Goods Transport Service Pvt. Ltd. — mobile logistics operating system.
Same modules and data model as the web build: Bookings, LR/CN (share as PDF),
Masters, Owned Fleet P&L, Hired Vehicles, Renewals & Compliance, Contracts &
Tenders (rate engine with rate guard), Accounting & Receivables, Reports (share
CSV), WhatsApp/Email triggers, Settings & JSON backup.

## Run it

Requires Node 18+ and the Expo Go app on your phone (Play Store / App Store).

```bash
npm install
npx expo install --fix   # aligns native package versions to the Expo SDK
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

## Build an installable APK / IPA

```bash
npm install -g eas-cli
eas build -p android --profile preview
```

(Requires a free Expo account. For Play Store / App Store distribution use
`eas build -p android` / `-p ios` with production profiles.)

## Data

Data is stored on the device (AsyncStorage). Settings → Export Backup shares a
JSON file; Restore accepts pasted backup JSON. Sample records are clearly
marked "(Sample)" and can be deleted. The hosted multi-user backend (shared
database, logins, e-way bill API, Zoho Books sync) is the Phase 1 server build
in BGTS_TMS_System_Design.md — this app and the web build share the same data
model so both plug into that backend later.
