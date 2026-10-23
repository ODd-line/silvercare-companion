# Developer guide: actual Silver Bank / Silver Care app

[README](../README.md) | [Operating manual](OPERATING_MANUAL.md)

## Repository migration

On 23 October 2026 this repository switched from the Expo prototype to the
existing Silver_bank application's working source, including its pending app
features. The Git history is preserved; the previous prototype remains at
commit `3cc198e`. It is not used by the new runtime.

Use npm and `package-lock.json`, not the old pnpm/Expo workflow. Supabase settings,
old Expo sessions, and the prototype's app identity do not migrate automatically.
This is a source replacement, not a deployment or user-data migration.

## Architecture

| Path | Responsibility |
| --- | --- |
| `app/page.tsx` | Shared application, navigation, account entry, and member flows |
| `app/*.css`, `components/` | Shared web/mobile layout and Silver Care UI |
| `mobile/main.tsx` | Mounts the same application with the native-app styling class |
| `mobile/vite.config.ts` | Builds bundled mobile assets into `mobile-www/` |
| `app/api/[...path]/route.ts` | API dispatch |
| `lib/` | Bank, Care, community, authentication, native-session, and watch logic |
| `db/schema.ts`, `drizzle/` | Database schema and ordered SQL migrations |
| `capacitor.config.ts`, `ios/`, `android/` | Native wrappers and secure-session integration |
| `vendor/`, `scripts/prepare-ble-spm.mjs` | Pinned native BLE compatibility patches and iOS watch-history storage |
| `scripts/preview-app.mjs` | Loopback-only sample API preview of the actual UI |
| `tests/` | Unit, browser, SQL/HTTP, and native-history checks |

The native bundle uses the same React page as the website. A smaller browser
viewport previews layout but does not emulate Keychain, BLE, background delivery,
or phone permissions.

## Install and preview

Requirements: Node.js 22.13+, npm, and platform tooling only when building native
code. Install the exact locked dependency set:

```sh
npm ci
npm run preview:app
```

Open `http://localhost:3042/#care/overview`. This builds `mobile-www/` and starts
a loopback sample-data server. It creates no real accounts, performs no real
database writes, and rejects unsupported booking/sharing/notification actions.
It is the easiest way to inspect the phone's interface without cloud setup.

The built-in **Try demo without signing in** is a separate app-level sample
session and is available in normal builds. Do not treat either demo as a
backend integration test.

## Backend and database

The application uses vinext/Vite and Cloudflare Workers with D1. `DB` is the D1
binding. Drizzle metadata and SQL migrations are checked into `drizzle/`.
`.openai/hosting.json` supports the original Sites target;
`cloudflare.deploy.json` selects the independent Cloudflare target.

**The supplied Cloudflare configuration identifies an existing account and
database.** Do not run remote migrations/deployments against it merely to test
a checkout. For a new installation, create an owner-controlled Worker/D1,
update the routing identifiers, and authenticate with your own Wrangler account.
The IDs are not credentials, but point at real resources.

### Local development

```sh
npm run build
```

Place generated local secrets in ignored `.dev.vars` as appropriate. Apply
pending migrations in filename order to your isolated local database. The
initial migration command is:

```sh
node --import ./scripts/sites-env.mjs node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_sticky_ken_ellis.sql
```

Apply subsequent `drizzle/*.sql` files once, in order, to that same local state
before testing newer features. Do not rerun already-applied SQL blindly.
Then run `npm run dev` (normally port 5173).

### Authorized Cloudflare deployment

After reviewing the target and backing up existing data:

```sh
npx wrangler login
npm run build:cloudflare
# These commands affect the configured remote resources:
npm run db:migrate:cloudflare
npm run deploy:cloudflare
```

`npm run build` selects the original Sites target; it is not interchangeable
with the Cloudflare build when deploying the independent Worker.

Required/optional server secrets are documented in `.env.example`:

- `ADMIN_SETUP_KEY`: one-time administrator bootstrap; remove after setup.
- `VERIFICATION_HASH_KEY`: stable secret for identity-fingerprint handling.
- `GROQ_API_KEY`: optional server-only AI provider key.

Use Wrangler's secret mechanism for a deployed Worker. Never put these secrets
in `VITE_*` variables or commit local secret files. Initial community setup must
complete before normal registration, including guests, becomes available.

Migrations include guest accounts, watch receipt provenance/deduplication, and
health/history support. A new frontend alone does not update the database.
Use backups and a reviewed migration plan for existing accounts.

## Mobile builds and compatibility

```sh
npm run mobile:build
npm run mobile:sync
```

`mobile:sync` prepares the pinned BLE Swift Package Manager integration and runs
Capacitor sync. Do not replace it with an unreviewed native-plugin update:
the preparation script checks the supported BLE plugin version and patch shape.

The app ID is **`community.neighbour.timebank`**, the installed name is
**Silver Bank**, and the product UI includes **Silver Bank** and **Silver Care**
under Silver+. These names match the actual app. The former Expo ID
`com.iena.silvercare` and `silvercare` scheme are not used.

### Backend selection

`lib/mobile-session.ts` defaults native requests to
`https://silver-bank.s20181076-cfd.workers.dev`. Browser requests use the same
origin as the website. Override native API routing at build time:

```sh
VITE_TIMEBANK_API_URL=https://your-authorized-backend.example npm run mobile:build
npm run mobile:sync
```

Changing the backend does not move accounts, sessions, or local watch scopes.
Never use a shared live backend for automated write tests.

### iOS

Open `ios/App/App.xcodeproj`. Use the intended signing team and the correct
physical-device or simulator destination. The source includes team/project
settings but no private signing keys or provisioning profiles.

```sh
npm run mobile:ios:sim
```

Simulator builds require their configured entitlements and signing; do not use
`CODE_SIGNING_ALLOWED=NO`. A physical build requires your own valid provisioning.
Free development profiles commonly last seven days. Preserve app data and
install updates in place when renewing signing; do not uninstall as a first fix.

Native bundle IDs and Keychain identity matter for upgrades. Copying this
repository does not grant signing access or migrate an existing app's data.

### Android

Open `android/` in Android Studio with an appropriate Android SDK and compatible
JDK (normally JDK 21 for this project). The imported validation report records
a Java 25/Gradle incompatibility; no Android release is implied by a successful
web or mobile-assets build. Do not publish a debug signing key as a release key.

## Watch, Care, and data boundaries

Read [PINETIME_WATCH.md](PINETIME_WATCH.md) for the implemented BLE services,
sensing sessions, consent, local history, and remaining physical validation.
This app does not use the earlier Expo prototype's `7c9a...` telemetry contract.

- Bluetooth reception, local history, cloud uploads, AI use, and sharing have
  separate consent and authorization.
- Native iOS history is scoped by account/backend and stored locally; signing
  updates must not erase it.
- The offline-watch entry does not provide offline access to private cloud
  accounts. Optional offline local history is separate from signed-in scopes.
- Care routes enforce private owner access. Partner/admin roles do not grant
  unrestricted health-record access.
- Browser fixtures, mocked BLE, and a successful connection do not demonstrate
  reliable locked-phone delivery or medically accurate readings.

The bank backend owns permissions, task state, reservations, and ledger
settlement. The mobile client and watch cannot mint credits or decide
authoritative balances. See the operating manual and imported notes for
current task policies and role restrictions.

## Tests and release checks

```sh
npx tsc --noEmit
node --experimental-strip-types --test tests/watch.mjs tests/preferences.mjs tests/app-demo.mjs
npm run test:community
npm run test:watch:care
npm run test:navigation
npm run test:watch:web
npm run test:guest
bash scripts/test-watch-history-native.sh
npm run build:cloudflare
```

Browser suites use Playwright. If Chromium is missing, install the required
browser with `npx playwright install chromium`, then rerun the affected suite.
The navigation suite covers mobile/compact layouts and the actual Care menu.

Python HTTP tests require a separately initialized disposable local Worker and
test database; inspect each test's fixture/port requirements first. Never run
synthetic workflow/health tests against production.

The [validation report](VALIDATION_REPORT.md) is a dated imported baseline, not
proof that every check was repeated after this repository migration. Inherited
full-lint debt, Android tooling, physical BLE/background reliability, and
production-authenticated flows require separate follow-up.

Publication to GitHub does not deploy the website, apply SQL remotely, build a
signed phone release, or renew Apple provisioning. Keep those operations
separate and explicitly approved.

## Source and data hygiene

Do not commit `.env*` secrets, `.dev.vars`, `.wrangler`, databases, phone backups,
`mobile-www`, `mobile-build`, `node_modules`, certificates, or generated releases.
Keep native project files, migrations, vendored source, and third-party notices.

Historical Expo metadata does not describe the replacement app's licensing.
Retain [third-party notices](../THIRD_PARTY_NOTICES.md) and bundled licenses;
review distribution obligations for all imported dependencies/assets.
