# One-hour welcome credit

New **personal member accounts**, including guest accounts, receive **3,600 seconds (one hour)** when their account is created. Organization/Community Partner accounts and administrator setup accounts retain their separate credit policies.

The database creates a posted `onboarding` ledger entry in the same transaction as the new user. The existing unique onboarding index prevents another grant for that account. Verification, login, recovery and profile updates do not replenish spent credit. Verification and profile/consent requirements for requesting or accepting tasks still apply.

Migration [0019_signup_credit.sql](../drizzle/0019_signup_credit.sql) replaces the old grant-on-verification trigger with the signup trigger and a fixed-amount guard. It preserves every previous ledger entry and does not backfill existing accounts. A legacy zero or larger configured amount cannot change the new grant. Setup/admin UI now describes the fixed policy; the API rejects attempts to set a different amount.

The local and built-in demos show one hour with a corresponding sample welcome entry. Demo balances remain sample data.

## Validation

Run `npm run test:welcome-credit` for an in-memory migration and real route-handler check covering native, browser and guest signup, rollback, duplicate signup, verification, login, recovery and preservation of old balances. `tests/credit-policy.py`, `tests/verification.py`, `tests/integrity.py` and `tests/verification-upgrade.py` cover accounting and verification regressions.

## Activation

Activated on the live `silver-bank-db` database on **27 October 2026**. Migration 0019 is recorded as applied; both fixed-hour triggers and the existing once-per-account unique index were verified. The two verification-time credit triggers are removed, and the configured welcome amount is 3,600 seconds.

The database migration activates the signup credit for the existing hosted API and installed app, because both already create users through the same database and derive balances from the ledger. Source/UI updates are also included in the saved project for the next app build.
