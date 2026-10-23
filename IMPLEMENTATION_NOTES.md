# Imported implementation notes

These notes were preserved from the Silver_bank working source when the actual
Silver Bank / Silver Care app replaced the Expo prototype in this repository
on 23 October 2026. Release/install statements below are historical snapshots,
not guarantees about the current phone, website, or backend. Start with the
[README](README.md) and [developer guide](docs/DEVELOPER_GUIDE.md) for this checkout.

### Proposal-Based Wellbeing Check-In

Community now includes **My talents** (`#talents`): a member-selected skill description, activity categories, meeting mode, preferred days, comfortable duration and an editable talent-card preview. Saving uses authenticated `GET/POST /api/talent-profile`, requires a matching owner ID on writes, and atomically updates existing skills/category and matching-preference fields. Other account fields and the Time Credit ledger are unchanged. Organisation accounts cannot use this individual-member flow.

Find matching opportunities opens the existing recommendations view. Ranking considers skills, categories, service area, meeting mode, preferred days and duration independently; optional previously consented broad activity preferences remain separate from raw Care data. Matching is a suggestion, not eligibility, attendance verification or medical clearance. Language, support needs, accessibility and detailed availability slots are not yet part of the talent model.

Run `npm run test:community` for ranking and migrated in-memory database tests, and `npm run test:navigation` for draft/save/retry/reload, recommendation handoff, role guards and responsive screenshots. These checks do not validate a deployed backend or physical watch transport. No production migration or deployment is required or performed for this slice.

Care Overview offers four explicit responses: I am fine, I am resting, I feel unwell, and Please ask someone to call me. Selecting a response does not save or share it. Confirm and save privately uses the existing private Care check-in API; the saved response appears in the timeline. The call response is a private observation, not a dispatched request: caregiver notification remains **Not sent**. Responses are not medical assessments or automatic participation restrictions.

`npm run test:navigation` covers response selection, failed-save retry, private record contents, timeline visibility, no automatic sharing, organisation-account restrictions, and desktop/mobile/compact layouts using mocked APIs. Real backend delivery, personal-baseline analysis and caregiver escalation are not verified by this test.

# Silver Bank

## Operating manual

See the [web and mobile operating manual](docs/OPERATING_MANUAL.md) for sign-in,
navigation, community tasks, Care records, watch permissions, sharing and
troubleshooting. The [validation report](docs/VALIDATION_REPORT.md) distinguishes
automated checks from deployed and physical-device checks.

`npm run test:demo` checks the built-in sample account's Profile data and
record-editing behavior. `npm run test:navigation` also visits every main dock
destination in the built-in demo, including Profile and the Programs screen.
Demo record edits update
the original sample note rather than making another copy; stale edits fail
explicitly. Demo changes remain memory-only.

### Automatic heart-rate sensing candidate

**Next candidate: iOS build 12 / Mastro 0.1.13**, built but not installed.
An additional opt-in keeps BLE reception active while the phone is locked and
lets the watch own the 15-minute schedule. Native protected, account/server-scoped
SQLite history retains sampled observations with original receipt times and no
automatic age-based deletion. My Watch provides paginated graphs/tables for old
records. Cloud upload remains foreground-only and separately consented; confirmed
uploads do not delete local history. Force-quitting, OS termination, radio loss
or watch shutdown can stop reception; reopening reconnects. Physical locked-phone
validation is still pending. Deploy the matching receipt-deduplication backend
and owner/receipt lookup index migration before installing build 12.

Previously installed:
iOS build 11 and Mastro OS 0.1.12 add an opt-in sensing request every
15 minutes while the phone app is open and connected. Each watch session allows
warm-up, then ten seconds of usable PPG estimates, with a 60-second total limit.
Unsuccessful sessions are reported explicitly. New estimates with unchanged BPM
are sent as new notifications rather than made to appear stale.

Both sides must be installed, and authenticated Bluetooth pairing is required.
iOS build 11 installation was verified on the connected iPhone. The user confirmed
the watch updated to 0.1.12 and a sensing session delivered new BPM readings and
completed. Screen-dark sensing, subsequent scheduled sessions and the remaining
physical release checks are not yet verified; MCUboot validation remains pending.
The sensing update has not been published to the live website.
Existing manual sensing and separate upload consent remain available. See
[the protocol and physical verification requirements](docs/PINETIME_WATCH.md).

### Remembered device options

The app remembers the last safe section, task tab and applied filters, home search,
watch-history range, spoken-reply language/on-off choice, authorized organization
selection, administrator tab, selected watch, step goal, and explicit watch
receive/save choices. These options are local to each device, account and backend;
demo choices remain in memory. Existing profile, language, matching and Care
privacy settings still use their existing explicit server-side Save actions.
Unsaved forms, passwords, recovery codes, signatures, live health readings and
upload tokens are not stored in preferences. Bookings, check-ins, microphone
recording, sharing and payments are never automatically repeated.

After opting in once, the installed app reconnects to the selected watch while
open, including after restart and across ordinary tabs. After **Start saving**,
previously enabled uploads re-enroll through the authenticated API and resume
when connected. **Stop saving** disables automatic uploads; **Disconnect** also
disables automatic reception. Switching accounts stops activity for the old
account. **Profile → Reset saved options** clears device options and stops
automatic watch activity without deleting server records. Storage failures are
shown explicitly. Offline watch mode remains live-only with no cloud uploads.

Run `npm run test:preferences`, `npm run test:watch:web`, and
`npm run test:navigation` for persistence, opt-out, account-isolation and restart
checks. See [watch lifecycle details](docs/PINETIME_WATCH.md).

### Persistent guest accounts

**Sign In → Continue as guest** creates a separate, server-backed individual account without an email or password. Save the private recovery code before entering the app. The code grants access to the account, including private health records; it is shown once, stored only as a hash on the server, and must not be shared. Existing seven-day sessions use HttpOnly cookies on the web and secure native token storage on mobile. **Already have a guest recovery code?** restores the same account after logout or expiry, invalidates earlier sessions and watch-upload credentials, and keeps saved records. On the same device, previously enabled watch choices can resume using freshly enrolled credentials; a new device requires new consent and pairing. A lost code cannot be recovered.

Guests can access all ordinary member sections, not administrator or partner privileges. Profile completion, policy acceptance, identity/age verification, balances, and task permissions still apply to community participation. Profile setup is deferred rather than bypassed: complete it from the guest banner or Profile. New guest accounts receive no automatic verification or Time Credit. Guest account creation does not consent to health storage; use the existing Care setup and selected watch-upload permissions. Demo remains separate and never uploads real readings.

Deploy the `0016_guest_accounts` migration and updated backend before distributing the updated mobile bundle. No existing account or health record is replaced. Run `npm run test:guest` for API/database and browser checks, including recovery, privacy isolation and existing access restrictions. Local tests do not prove that production or the installed phone has been updated.

Login and initial loading offer **Try demo without signing in**. This creates an in-memory sample session inside the app, including watch graphs and local check-ins. Demo requests never use the real API or stored native credentials; unsupported bookings, sharing and watch uploads are rejected. **Exit demo** discards sample changes and returns to login. Restarting does not preserve the demo session. Normal server authentication is unchanged. This is available in the bundled iPhone app, not just the loopback preview.

My Health includes heart-rate and step-counter observation graphs for the last 24 hours or 7 days, latest saved readings, timestamp provenance, and an accessible exact-value table. Graphs use the existing private `care.measurements` response (up to 500 recent readings); refresh reloads that history without enabling collection. Individual points do not interpolate missing intervals, and step counters are not summed into daily totals. Sensor timestamps and phone receipt times remain distinct. No diagnosis, background monitoring or automatic sharing is added.

The loopback demo supplies explicitly labelled sample readings including a step-counter reset. Navigation tests cover populated and empty charts, range selection, invalid/future/old readings, decimal sensor values, refresh failure/retry and three viewport sizes. These checks do not verify physical watch transfer or a deployed backend.

A mobile-first, persistent community Time Bank. React/Vinext frontend; Cloudflare Worker API; D1 SQLite database with atomic triggers, durable sessions, ledger and audit records. No product seed users or task data.

## First use

Open the deployed application. The first administrator uses the one-time `ADMIN_SETUP_KEY` configured as a hosted secret, enters their own details, and chooses introductory credit in whole minutes. Registration remains closed until that step completes. Save the recovery key displayed after account creation. Later accounts join through Create account. Email is an account identifier; email delivery/verification is not configured. Password recovery uses the saved private recovery key, rotates that key and revokes earlier sessions.

## Core rules

- Authoritative amounts are integer seconds. All tasks have the same time rate, with no cash conversion.
- Posting reserves estimated time atomically. Available balance is ledger total less held time. Reservation does not pay a helper.
- Only another member can accept an open task; a conditional database update prevents simultaneous claims.
- Both people confirm readiness. The second confirmation records the database start timestamp.
- Either participant finishes; actual time is the server finish minus start, with a minimum one second. The other participant confirms settlement.
- Actual duration can exceed the estimate. Members may post requests and settle with a zero or negative balance. Posting subtracts the estimate from available time; completion replaces that reservation with the actual service debit. Negative balances represent time to contribute back.
- Completion releases the reservation and transfers equal time in the same SQLite statement transaction. A unique task/type index and final-state guard prevent duplicate settlement.
- Disputes freeze the task without paying. Administrators can cancel/release or settle an already finished disputed task. Every administrative action needs an audit reason. Adjustments append ledger records; no balance overwrites.
- Reviews are one per participant per completed task. Task messages are participant-only. Suspensions revoke sessions and block sign-in.

## Security and persistence

Passwords use salted PBKDF2-SHA256 (100,000 iterations, Worker WebCrypto limit). Session and recovery tokens have 256 bits of entropy; only token hashes are stored. Web sessions use Secure, HttpOnly, SameSite cookies and expire after seven days. Native tokens use iOS Keychain and Android Keystore-backed encrypted storage. Web mutations require same-origin JSON. Native apps use bearer sessions with explicit native request headers; CORS permits only configured Capacitor origins. Authentication attempts are rate-limited in D1. Authorization is checked by the backend on each protected request. Frontend balance, user IDs, and duration claims cannot determine settlement.

Ledger and administrator-audit history are immutable through database triggers. Source and destination foreign keys, review uniqueness, task-state triggers and exact integer-time settlement protect consistency. Database migrations are schema-only. Starter credit and categories are inserted by authorized setup, not a hardcoded user seed.

Profile images are constrained to small PNG/JPEG/WebP data URLs (up to 1 MB image input) and stored persistently in D1. General service area is public to signed-in members; precise addresses should be shared only in private task messages. Updates refresh periodically; ledger history supports loading older records.

## Local development

### Independent Cloudflare account

The original Sites deployment remains the default. `cloudflare.deploy.json` describes a separate owner-controlled `silver-bank` Worker and `silver-bank-db` D1 database, bound as `DB`. These IDs are routing identifiers, not credentials. Use Wrangler OAuth; never commit tokens or secrets. This database starts empty and does not copy or change the original Sites database.

The independent backend is `https://silver-bank.s20181076-cfd.workers.dev`. Normal mobile builds now use this address by default; `VITE_TIMEBANK_API_URL` remains an explicit build-time override. iOS 1.6 build 8 includes persistent guest access. Sign in using an account created on this backend or create a new guest; accounts and records from the original Sites backend are not migrated.

iOS 1.6 build 9 also offers **Use watch without internet** during startup and on the login screen. This is a live Bluetooth-only session, not demo mode or offline account access: no sign-in, cached account records, persistent readings, or cloud uploads. Reception still requires explicit session consent, Bluetooth enabled, the phone app in the foreground, and the watch powered on. Leaving the screen disconnects and clears readings. A dark watch display alone does not require Wi-Fi; heart-rate measurement may stop independently under the firmware's session rules. In signed-in Care, My Watch now renders even while account records are loading or fail to load. Cloud storage remains separate and requires account setup and internet.

1. `npx wrangler login`
2. `npm run db:migrate:cloudflare` applies pending migrations to this specific remote database.
3. `npm run deploy:cloudflare` builds with `SILVER_BANK_HOSTING=cloudflare` and deploys the generated Worker configuration. Ordinary `npm run build` still targets Sites; do not deploy its placeholder database configuration to this account.
4. Set a strong `ADMIN_SETUP_KEY` through `npx wrangler secret put ADMIN_SETUP_KEY --config dist/server/wrangler.json`, then complete the normal first-administrator setup on the deployed site. Registration, including guests, stays closed until setup completes. Remove this one-time secret after successful setup.
5. Build the phone app with `VITE_TIMEBANK_API_URL=https://<your-worker-host> npm run mobile:build`, then `npm run mobile:sync` and a signed native build. Existing installed app data is not migrated to the new backend; its old session will not authenticate there.

Explicitly configure any optional AI provider secrets in the new account if needed; old hosting credentials are not copied. Verify account login, guest recovery, and saved-reading retrieval against the new HTTPS backend before distributing an updated app.

For an account-free, sample-data app preview, run `npm run preview:app` and open `http://localhost:3042/#care/overview`. This separately served loopback demo skips setup only in its own API fixtures. Its visible banner identifies sample data; check-ins and talent edits stay in memory and reset on restart. It creates no real accounts, performs no database writes and blocks booking/sharing/notification actions. The normal app and backend authentication are unchanged.

Node >=22.13 is required. `npm ci`, then `npm run build`. Put a generated `ADMIN_SETUP_KEY` in ignored `.dev.vars`. Apply each migration once:

```
node --import ./scripts/sites-env.mjs node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_sticky_ken_ellis.sql
npm run dev
```

Production source is built and deployed through Sites, with D1 migrations applied before the Worker deploys. `.dev.vars`, `.wrangler`, and all test database records are excluded from source publication. `.env.example` documents the hosted secret key.

## Verification

`npm run test:navigation` builds the existing mobile app and checks the unified member shell (Home, Community, Care, Time Bank, Profile) with test-only HTTP fixtures. It preserves task creation and Care deep links, verifies organization accounts never mount private Care, checks the verified-partner dock, and captures desktop/mobile layouts. Care storage and watch receipt still require their existing separate consent; leaving Care ends its foreground watch session. No backend migration or live delivery is added by this navigation change.

Care opens a temporary menu above the same bottom dock button: Overview, My Health, AI chat, Timeline, My Watch, Appointments, Family and Care settings. The permanent top Care tab strip is removed; existing routes and page actions remain available. Navigation tests cover keyboard selection, Escape and outside-click dismissal, route-change closing, focus restoration, and menu bounds at 1280px, 375px and 320px widths.

`tests/workflow.py` runs real HTTP requests against a fresh isolated local Worker at port 8787 and `.wrangler/test-state`. It creates independent temporary test accounts, tests concurrent acceptance and posting, two-person start and completion, duplicate settlement, ledger conservation, private messages, reviews, notifications, sign-out/sign-in persistence, recovery, suspension, and administrator adjustments. Never run it against production. Initialize the isolated database with the migration before each complete test run.

`tests/integrity.py` validates SQL-level negative-balance settlement, immutable ledger/audit, duplicate onboarding and settlement constraints, and invalid task transitions. These tests are independent of product data.

## Operational scope

This release implements Time Bank only. Community moderation is performed in the administrator screen. Recovery keys must be saved by members; there is no email-reset delivery or verified-email claim. Introductory credit can be set to zero to avoid unrestricted issuance. The platform does not claim to verify real-world service delivery or unique human identity. Set community policies before inviting members.

## Registration and agreements

Registration stores service area, private phone number, preferred language (Traditional Chinese, English, German, French, Japanese), and private age range. The interface changes immediately between all five supported languages; the chosen language is persisted in the account when saved. Original user-written content and the supplied English agreements retain their original wording. Existing members must complete these fields and sign current agreements before further task participation.

Both agreements from the supplied 15 September 2026 PDF are stored with content-derived versions. Account and historical per-task acceptance records retain the member, name, handwritten numeric strokes, document version and server timestamp; database triggers prohibit edits and deletion. Account-level agreements cover participation. Each participant confirms readiness before starting, without signing again. The original PDF and versioned JSON remain available under public/guidelines. References to unsupported health, watch or calling functions do not add those functions to the app.

## Installed mobile apps

The `mobile` entry bundles the same frontend into Capacitor iOS and Android applications. Assets ship inside the app; the shared HTTPS service provides accounts and persistent data. Internet access is required. There is no remote `server.url` wrapper or browser-only local account store.

Build with `npm run mobile:build` and `npm run mobile:sync`. Open `ios/App/App.xcodeproj` in Xcode (Swift Package Manager), or open `android` in Android Studio. iOS device installation and TestFlight distribution require the owner's Apple signing team. Android debug builds are for direct testing; store distribution requires an owner-controlled release signing key and store account. Do not publish debug signing keys as release credentials.

For temporary on-device Bluetooth testing without an account, run `VITE_WATCH_TEST_MODE=true npm run mobile:build`, then `npm run mobile:sync` and build/install in Xcode. This labelled test screen uses the real Bluetooth receiver with explicit session consent, no account API requests, and no private uploads. It does not bypass backend authorization. Do not publish this test build. Restore the normal landing and login screens with `npm run mobile:build` followed by `npm run mobile:sync` and a new native build/install.

Native integration tests in `tests/mobile_auth.py` verify bearer authentication, revocation, consent rejection and saved profile edits against the isolated local server. `tests/workflow.py` covers negative reservations and actual settlement using independent accounts; `tests/integrity.py` checks immutable ledgers and consent, uniqueness, state transitions and settlement conservation.

## Language, phone and handwritten signatures (1.1)

Phone input separates the international calling code and national number. libphonenumber-js supplies calling-code metadata and validates possible numbers; the backend stores a normalized international number. Existing phone records are split when editing.

All five interface languages have explicit catalogues; dates and time units use the selected locale. No DOM text replacement or external translation service is used. Member names, task descriptions, private messages and original agreements are not machine-translated. Language changes preserve form values and the drawing. Save profile persists the language to the account; device-local language is also remembered before login.

New agreement acceptances require a blank-start handwritten signature pad and name. The backend validates bounded numeric strokes and stores them in the immutable agreement record. Original typed-only acceptances remain intact; there is no invented handwriting for earlier records. Members can inspect their own signed agreements on Profile. Blank, malformed and oversized drawings are rejected. Keyboard drawing is supported for accessibility.

Tests: `node scripts/test-interface.mjs` renders all five languages and checks stable form field names, phone parsing, no prefilled signatures and drawing validation. Existing HTTP tests also check saved drawings, changed calling codes and rejection of administrator access for ordinary members, including a forged role on registration.

## Task start and photo messages (1.2)

Starting a task only confirms readiness. Both participants must still be ready before the authoritative start timestamp is recorded. Account agreements remain required; previous signatures are preserved and no new task signature is requested.

Private task messages support optional JPEG, PNG or WebP photos, with or without text. The client resizes and re-encodes uploads to JPEG (removing original metadata), and the backend checks size, MIME and file signatures. Each stored image is limited to 600 KB. Photo data is stored with the private D1 message record, with no public image URL. Message reads and writes require task participation, including paginated reads; administrator status alone does not grant chat access. The latest ten messages load first, with older pages available to bound response size. Existing text messages remain unchanged.

## iOS simulator secure-storage correction

Simulator builds must retain Xcode's simulator entitlements. The iOS project now applies `App/Simulator.entitlements` only to the simulator SDK, providing an application identifier and private Keychain access group. Build with code signing enabled (ad-hoc signing is sufficient for the simulator); do not use `CODE_SIGNING_ALLOWED=NO`. Real-device builds continue to use the Apple team's normal signing settings.

On an Apple Silicon Mac with a booted iOS 18 simulator, `bash scripts/test-ios-keychain.sh` checks empty lookup, creation, reading, updating and deletion using disposable records, without reading member credentials. The original unsigned configuration returned -34018 (missing entitlement); the corrected configuration supports these operations.

## Community support (1.4)

Optional request drafting and category suggestions use Groq `qwen/qwen3.8-27b`. Configure `GROQ_API_KEY` as a server secret, never in a mobile bundle. The member must opt in before their description is sent; only their entered text, active category names/IDs, chosen timezone and current timestamp leave the service. Suggestions populate editable fields and never post or alter balances. Missing or low-confidence fields remain blank. Provider failures return to the ordinary form.

Keep the Groq organization on its **Free plan**. Code cannot determine or enforce the provider's billing plan. There is no paid-provider fallback, automatic plan upgrade, retry loop or paid built-in tool. Atomic call reservations limit the whole community to an administrator-configurable maximum of 20 attempts per UTC day, at most 5 per member, with 30 seconds between global attempts. Output is capped at 900 tokens. Attempts, outcomes, model and token usage are recorded without prompt content. Free allowance may also be shared with other apps. Admin > Community insights allows disabling processing and reducing limits to zero.

Recommendations use deterministic rules over existing service area, skills, category preferences, completed helping history and private optional weekday/meeting/duration preferences. They are suggestions, not guarantees of availability or exact distance; all tasks remain browsable. No scores or location coordinates are sent to an external model.

Community insights use real database aggregates. Category counts cover requests created in the last 30 days; daily completion/contribution covers tasks confirmed in that period; area and stale queues describe currently open requests. Counts of recent helpers are not a measure of current available helpers. Review flags identify repeated exchanges, unusually short completions, multiple disputes and repeated titles; they do not prove misconduct. A human must review linked task records, record a reason and apply any separate authorized action. No automatic penalties or ledger changes occur.

Dispute summaries show stored timestamps, status history, ledger entries, reported concerns and recent participant statements. They are structured record summaries, not an external language-model judgment. Only administrators may access them; each access is audited. This narrowly scoped dispute-review endpoint can show the latest 100 text statements, while ordinary message endpoints remain participant-only. Photos are not copied into the summary. Earlier task history was not invented or backfilled. Status history is append-only from this update onward.

`tests/community.py` first runs the original workflow on a fresh isolated local service, then tests matching preferences, privacy, recommendation eligibility, admin flags/reviews, dispute records and disabled-provider fallback. `TEST_GROQ=1` additionally requires a real synthetic Groq draft to succeed; that check can fail if the provider rejects the local Workers runtime even when the same key succeeds through a direct client. Never run these fixtures against production.

## Clean interface (1.5)

The supplied Google Sans variable fonts are bundled locally as WOFF2 with their OFL license. System fonts cover scripts absent from the supplied font. Home shows the signed-in member's service area, greeting, ledger-derived balance and the latest in-person requests matching that area. Search filters these retrieved requests; View all opens task discovery. Category icons are interface symbols, not photos of a particular member's service. Recommendations remain available as a Tasks tab. Member-authored descriptions remain in task details. Promotional captions, repeated headings and the footer have been removed. The shared interface is used by web, Android and iOS.
# Current local review changes

- Community selection uses country → region → city choices in registration, profiles, requests and filters. The backend validates the canonical selection; existing stored locations remain readable. Where the reference dataset has no subdivisions below a region, the region is the community. Regenerate reference data with `node scripts/build-communities.mjs` after changing its locked dependency.
- Request posting is now limited to available credit; reservations and transfers are guarded atomically in the database. Starter credit is issued once, with no automatic refill. Migration `0006_credit_limit.sql` enables the rule without rewriting history.
- Available task cards use the React Bits JS-CSS CircularGallery implementation, adapted for real task content. List view is available, and reduced-motion preferences automatically use the list.
- Local development detects the Mac's configured HTTPS proxy (or `HTTPS_PROXY`) for Groq. A randomly authenticated, loopback-only transport keeps provider credentials server-side and preserves the API's consent and usage checks. Production builds do not contain this development transport configuration. Groq remains the only provider; no paid fallback is configured.
- Verified the AI form with a synthetic description, interface rendering in five languages, and HTTP registration/profile persistence/task settlement against a separate test database. This review has not been published.

## Preview and Sites publishing

Run `npm run dev` for development. Run `npm run build` then `npm start` for a production-build preview at http://localhost:5173. `PORT` and `HOST` may override the preview address; `npm start` builds automatically if the production output is missing.

Run `npm run sites:package` to build and create `.sites-runtime/silver-bank-deploy.tar.gz`. This project-local script replaces dependence on an absent plugin packaging script. Publish the exact committed source to the existing Sites source repository, save a Sites version using that commit and archive, then deploy that saved version. Local secrets, databases and account records are excluded from the archive.

## Individual and NGO verification

Separate registration paths and free manual verification are described in [Verification operations](docs/VERIFICATION.md). Existing navigation, histories and active tasks remain available while new participation requires approval.
