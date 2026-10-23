# Silver Bank Companion

An Expo companion app for a community Time Bank linked to the Mastro watch. Members exchange time at an equal rate: one hour of help earns one hour of credit.

## Product flow

1. A member signs in and joins a trusted local circle.
2. **Community** lists requests from other members. A member can offer time or post a request that reserves available credit.
3. Accepted work appears in **Home** as the next scheduled task.
4. The phone or watch records start, finish, and confirmation actions.
5. The authenticated service validates each state transition and idempotency key.
6. Only after the required confirmations does the production service post an immutable entry in **My Time** and return a new confirmed balance.

The watch is a convenient remote, not a bank. It may cache actions while offline, but it cannot create credits, settle disputes, approve members, or calculate the authoritative balance.

## App structure

- **Home**: pending confirmations, next task, available time, and direct shortcuts.
- **Community**: category-filtered requests, a validated request form, and My exchanges.
- **My Time**: available time (confirmed minus reservations), reserved requests, and completed transfers.
- **Watch**: Mastro pairing, connection state, and the watch-to-phone-to-service contract.

Task details open from Home, Community, and new time records. On phones, the browser navigation sits at the bottom; wider browsers use top navigation. Account settings are accessible from every screen. The member workspace deliberately uses a consistent light theme until a complete dark theme is available.

The Time Bank workspace currently uses an in-memory demo model on every platform, even when account authentication is configured. A visible notice distinguishes this from a live service. Data resets when the app restarts or the account changes; nothing is submitted to a production Time Bank. Drafts remain while switching Community sections but are not saved across restarts.

Posting a request validates its future local date/time and a duration of 15–240 minutes in 15-minute steps, then reserves available time. Cancelling an open request releases that hold. Accepting a task updates the shared schedule. Starting and finishing move it to confirmation. Both the member confirmation and an explicitly labelled simulated partner confirmation are required before posting exactly one signed time entry. Helping earns time; receiving help spends time and releases the reservation. Demo helper acceptance and partner confirmation buttons never contact another member.

Messaging, rescheduling, disputes, reminders, cross-device persistence, and production transfers are not yet implemented. The demo must not be used as a real community ledger.

## Watch integration

The native app uses `react-native-ble-plx` to scan for and connect to the encrypted Mastro GATT service. Web builds expose a clearly labelled simulated watch.

Current BLE identifiers:

- Service: `7c9a1000-6f52-4f18-a3d1-8f3d3a79c001`
- Snapshot: `7c9a1001-6f52-4f18-a3d1-8f3d3a79c001`
- Commands: `7c9a1002-6f52-4f18-a3d1-8f3d3a79c001`

BLE discovery and connection are implemented. The production Time Bank snapshot/action packet contract is the next integration step; the current firmware characteristics still carry the earlier prototype payloads. The UI therefore never claims that a watch action has reached the server.

## Production authority model

The backend must own:

- membership and trusted-circle permissions;
- task creation, acceptance, readiness, start, and completion transitions;
- integer-second reservations and balance conservation;
- two-party confirmation and dispute freezes;
- idempotent watch and phone action processing;
- immutable ledger and audit records.

The current Supabase schema is inherited from an earlier prototype and is not a production Time Bank schema. Before deployment, replace it with task, participation, reservation, ledger, device-enrollment, and action-outbox tables protected by row-level security and server-side transaction functions.

## Run

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

Physical Bluetooth requires a native development build:

```bash
corepack pnpm exec expo prebuild
corepack pnpm exec expo run:ios
# or
corepack pnpm exec expo run:android
```

## Validation

```bash
corepack pnpm exec tsc --noEmit
corepack pnpm lint
corepack pnpm test:time-bank
```