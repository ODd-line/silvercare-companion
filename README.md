# Silver Bank + Silver Care

The **actual Silver+ web and mobile app** used by the Silver Bank / Silver Care
iPhone build, now maintained in
[ODd-line/silvercare-companion](https://github.com/ODd-line/silvercare-companion).

This repository replaces the earlier Expo companion prototype with the shared
React web interface, API, database migrations, and Capacitor iOS/Android projects.
It is not a restyling of the Expo demo. The mobile entry renders the same
application as the website, with native session storage and watch integration.

## What is included

- **Silver Bank:** member profiles, community requests, talents and matching,
  task readiness/completion, time reservations and ledger, reviews, disputes,
  verification, and partner/admin workflows.
- **Silver Care:** consent-based private check-ins and notes, My Health,
  Timeline, optional AI chat, appointment summaries, family contacts, and
  controlled sharing.
- **My Watch:** PineTime/Mastro BLE reception in native apps, separate
  receive/local-save/cloud-upload choices, and native iOS history support.
- **Accounts:** email/password accounts, recovery keys, persistent guest
  accounts, and a separate in-memory practice mode.
- **Mobile interface:** the installed app's bottom dock: Home, Community, Care,
  Time Bank, and Profile. Care opens its own section menu.

Real account workflows use the backend; they are not the old Expo session-only
Time Bank model. The built-in demo and local sample preview remain intentionally
separate from real accounts and transactions.

## Documentation

- [User quick start](docs/USER_GUIDE.md)
- [Complete operating manual](docs/OPERATING_MANUAL.md)
- [Developer guide](docs/DEVELOPER_GUIDE.md)
- [PineTime/Mastro integration and hardware limits](docs/PINETIME_WATCH.md)
- [Silver Care data and consent model](docs/silver-care.md)
- [Weekly email summaries with Resend: status and plan](docs/WEEKLY_EMAIL_PLAN.md)
- [Weekly email deployment and operations](docs/WEEKLY_EMAIL_SETUP.md)
- [Historical validation report and known limitations](docs/VALIDATION_REPORT.md)
- [Imported implementation/release notes](IMPLEMENTATION_NOTES.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## See the same interface as the phone

Use **Node.js 22.13+** and npm:

```sh
npm ci
npm run preview:app
```

Open **http://localhost:3042/#care/overview**. Resize the browser to a phone-sized
viewport to inspect the mobile layout. This runs the real shared UI with local,
in-memory API fixtures: no real accounts, cloud writes, bookings, or messages.
It is not the former Expo sign-in screen. Stop the preview with Ctrl+C.

Profile opens with a compact identity card, contribution stats, and grouped
community/account actions. Choose **Edit profile** or **Personal details** to
update account information, language, talents, or your photo. Availability and
agreements expand in place; device-only reset options stay under **Device options**.

Alternatively, the normal app offers **Try demo without signing in**. Native
Bluetooth and native storage require an installed build; a browser cannot
validate those features.

## Build the installed app

```sh
npm run mobile:build
npm run mobile:sync
```

Open `ios/App/App.xcodeproj` in Xcode or `android/` in Android Studio. Use your own
signing account and compatible toolchain. The native app identity remains
`community.neighbour.timebank`, with display name **Silver Bank**, so the source
matches the installed app rather than creating an unrelated Expo identity.

Normal native builds currently default to
`https://silver-bank.s20181076-cfd.workers.dev`. To target another authorized
backend, set it explicitly before building:

```sh
VITE_TIMEBANK_API_URL=https://your-worker.example npm run mobile:build
npm run mobile:sync
```

Do not use the shared live backend for automated tests. Accounts and records do
not automatically migrate when you change the backend.

## Backend and validation

The backend uses vinext/Vite, Cloudflare Workers, and D1/Drizzle migrations.
There is no Expo runtime or Supabase dependency in this version.
Read [backend setup](docs/DEVELOPER_GUIDE.md#backend-and-database) before running
deployment or migration commands; the included Cloudflare config points at an
existing account/database, not a disposable test environment.

```sh
npx tsc --noEmit
npm run test:watch
npm run test:preferences
npm run test:demo
npm run test:community
npm run test:watch:care
npm run test:navigation
npm run test:profile:web
npm run build:cloudflare
```

Full lint has an inherited backlog; see the validation report. Passing a browser
or unit test does not certify physical radio behavior, clinical accuracy, or a
deployed backend. GitHub publication does not deploy the website, run production
migrations, or install/renew an iPhone build.

## Privacy and safety

Keep credentials, recovery codes, signing keys, phone backups, local databases,
and real health records out of Git. `EXPO_PUBLIC_*` values from the previous
prototype are not used by this app. Secrets belong in your authorized hosting
environment or ignored local configuration.

Silver Care is not an emergency service, diagnostic device, or guarantee of
continuous monitoring. Bluetooth receipt, local history, cloud saving, AI use,
and sharing have distinct consent and connectivity requirements. Read the
operating manual before using real data.

## Repository transition

The old Expo implementation remains in Git history (including commit `3cc198e`).
This replacement does not convert its Supabase accounts or health records.
The original Silver_bank working directory is left unchanged. Third-party
assets and adapted components retain their notices; no blanket relicensing
of the imported app or its dependencies is implied.
