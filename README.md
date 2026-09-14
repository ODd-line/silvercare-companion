# SilverCare Companion App

Cross-platform Expo application for two planned SilverCare products: Predictive Gait Insoles and the Rotary Photo-Dial Communicator. The app supports iOS, Android, and web from one TypeScript codebase.

## Current features

- Email account creation and sign-in through Supabase Auth
- Mandatory first-run support profile and versioned consent flow
- Personal details, emergency contact, mobility context, allergies, and caregiver notes
- Product preferences for gait insoles and the photo-dial communicator
- Up to eight ordered photo-dial contacts
- Per-user database isolation through Postgres Row Level Security (RLS)
- Honest pre-hardware states for pairing and gait readings
- Interactive Three.js system model showing insole layers, pressure zones, motion sensors, controller, and battery placement
- Versioned Mastro OS companion payload for future authenticated watch transport
- Native iOS/Android BLE discovery and connection through `react-native-ble-plx`

Hardware pairing, sensor ingestion, gait analysis, and communicator calling are not implemented yet.

## Watch integration

Mastro OS already contains a native SilverCare screen, local wearer check-ins, a possible-collapse evidence evaluator, and Wi-Fi support. The app defines companion payload version 1 in `src/lib/watch-integration.ts` so both products have an explicit data boundary.

The native app scans for the SilverCare GATT service, connects, discovers services, and reads the readiness characteristic. iOS and Android permissions are configured through the `react-native-ble-plx` Expo plugin. Because Expo Go cannot load this custom native module, use a development build for physical BLE testing. The web preview provides clearly labeled simulated devices.

The BLE identifiers are:

- Service: `7c9a1000-6f52-4f18-a3d1-8f3d3a79c001`
- Readiness snapshot: `7c9a1001-6f52-4f18-a3d1-8f3d3a79c001`

Authenticated account enrollment, private gait-data transfer, commands, and remote check-in delivery still require implementation and hardware validation. A successful BLE connection must not be presented as medical monitoring or guaranteed message delivery.

## Predictive gait insole concept

The Devices screen includes an interactive 3D system concept with:

- Four pressure zones under the toe, forefoot, midfoot, and heel of each foot
- A six-axis motion sensor near the arch
- A heel controller and radio module
- A separate rechargeable battery zone
- Routed sensor traces within a layered insole shell
- An STL export of the generated left/right concept pair

The nominal concept length is about 235 mm per insole. Three.js geometry units are treated as millimetres by the STL export. The geometry is intended to communicate architecture and component placement, not to fit a foot or go directly to manufacture.

This is concept geometry, not production CAD or a clinically validated sensor layout. Footwear fit, flex life, calibration, battery protection, charging, ingress resistance, thermal behavior, biocompatibility, and manufacturability require physical prototypes and specialist review.

## Database setup

1. Create a project at [Supabase](https://supabase.com/dashboard).
2. Open the project's SQL Editor.
3. For a new database, run these migrations in order:
   - `supabase/migrations/20260906000000_initial_user_health_data.sql`
   - `supabase/migrations/20260913000000_gait_insoles_photo_dial.sql`
4. If the original medicine-box migration is already installed, run only `20260913000000_gait_insoles_photo_dial.sql`. It removes the obsolete medication table and adds the new product schema.
5. In Supabase Authentication settings, configure email confirmation and allowed redirect URLs for the deployment environment.
6. Create `.env.local` from `.env.example` and fill in the project URL and public publishable or anon key:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-key
```

The public key is intended for client applications and relies on the migrations' RLS policies. Never put a Supabase secret or service-role key in an `EXPO_PUBLIC_` variable.

## Install and run

```bash
corepack pnpm install
corepack pnpm start
```

Platform shortcuts:

```bash
corepack pnpm ios
corepack pnpm android
corepack pnpm web
```

Physical Bluetooth requires a native development build because Expo Go does not include `react-native-ble-plx`:

```bash
corepack pnpm exec expo prebuild
corepack pnpm exec expo run:ios
# or: corepack pnpm exec expo run:android
```

The web build keeps the same pairing workflow with clearly labeled simulated devices. It never reports the browser demo as a physical BLE connection.

Validation:

```bash
corepack pnpm exec tsc --noEmit
corepack pnpm lint
corepack pnpm exec expo install --check
```

## Data model

- `profiles` stores one support profile per authenticated user, including mobility context and product preferences.
- `photo_contacts` stores up to eight ordered contacts for the rotary dial.
- `connected_devices` reserves per-user device identity and pairing metadata.
- `gait_readings` stores timestamped gait indicators for the owning user to read.

The `complete_product_onboarding` database function saves the profile, consent, and photo contacts in one transaction. Exposed tables use RLS based on `auth.uid()`, and anonymous table access is revoked.

## Product boundaries

SilverCare is a student prototype, not a certified medical device, diagnostic tool, fall-prevention guarantee, or emergency service. Gait indicators may support review of walking trends but cannot diagnose a condition or predict a fall with certainty. Photo-dial calls depend on correct setup, power, network coverage, phone services, and the recipient answering.

The included terms and consent language is prototype product copy, not legal advice. Before handling real health data, obtain legal and clinical review and complete the security, privacy, retention, deletion, breach-response, accessibility, and regulatory work required in every deployment jurisdiction. Supabase configuration and RLS alone do not establish health-data compliance.