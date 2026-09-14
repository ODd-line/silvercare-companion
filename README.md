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

Hardware pairing, sensor ingestion, gait analysis, and communicator calling are not implemented yet.

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