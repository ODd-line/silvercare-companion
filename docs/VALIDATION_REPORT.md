# Web and mobile validation report

**Repository migration note (23 October 2026):** this report was imported with
the actual Silver Bank / Silver Care source. The results below describe the
19-20 October audit, not a new deployment or a repeat of every test in this
checkout. See the [developer guide](DEVELOPER_GUIDE.md) for current build and
validation commands.

## Repository migration checks: 23 October 2026

The actual app source was copied into `ODd-line/silvercare-companion` without
changing runtime components, styles, native identity, or business logic.
Source comparison verified all 381 imported files, with differences confined
to repository documentation and package metadata.

Passed in this checkout: TypeScript, 46 watch/preferences/demo unit tests,
community matching and isolated persistence checks, watch/Care ingestion,
native Swift history tests, mobile asset build, responsive navigation/Care
browser suite, Cloudflare production build, and Capacitor synchronization.
The actual Care overview was also opened in a phone-sized browser preview.

No website deployment, remote database migration, physical-device installation,
new native compilation, or full-lint cleanup was performed. The preview uses
local sample data only. The audit below retains its original dates and scope.

**Audit: 19-20 October 2026.** Scope: the current Silver Bank/Care project,
its shared web/mobile frontend, isolated backend workflows, and approved live
website deployment. This is not a guarantee of zero errors or a medical-device
certification.

## Release status

- Website deployed with user approval:
  https://silver-bank.s20181076-cfd.workers.dev
- Cloudflare version: `fe24a21a-979d-40c4-b674-df30740e5dd8`.
- No production database migration or synthetic production account creation.
- Updated web assets synchronized into the iOS and Android projects.
- Final iOS simulator build compiled and launched in a newly created, isolated
  simulator. The physical phone was **not updated**.
- Android native build remains blocked by the local toolchain; see below.

## Defects corrected

| Defect | Root cause | Correction and evidence |
| --- | --- | --- |
| Demo Profile crashed | Sample member response omitted `reviews`, which the Profile screen maps over. | Supply the real response shape. Added unit and browser navigation checks; live Profile opens after deployment. |
| Demo Programs crashed | Sample endpoint returned an array instead of the program-screen response object. | Supply programs, enrolments, support, badges and matches collections. Regression and live empty-state checks pass. |
| Editing a demo health note created a duplicate | Sample save handler always created a new ID. | Update the existing record, increment its version, reject stale/deleted records. Unit, browser and live create/edit checks leave exactly one updated record. |

These are shared frontend/demo corrections, not changes to real health records,
credit settlement rules, or production account permissions. Demo remains
memory-only and does not submit its sample actions to the real API.

## Passed checks

| Check | Evidence |
| --- | --- |
| TypeScript | `npx tsc --noEmit` passed. |
| Production web build | `npm run build:cloudflare` passed; deployment succeeded. |
| Mobile frontend | `npm run mobile:build` and `npm run mobile:sync` passed. |
| iOS native build/startup | `npm run mobile:ios:sim` passed; final app installed and launched in an isolated simulator. Initial native screen visually inspected; process liveness confirmed. |
| Watch/preferences units | 43 passing tests: consent, reconnection, sensing intervals, malformed/stale readings, account isolation, upload retries and preferences. |
| Demo units | 3 passing regression tests for Profile, Programs and versioned note editing. |
| Navigation browser suite | Main demo dock, Programs, in-place note editing, eight Care destinations, keyboard/focus, responsive menu bounds, talent saving and role restrictions. |
| Watch browser suite | Connection stages, retry/error states, stale values, saving permissions, account cleanup and layouts at four viewports. Radio transport is simulated. |
| Guest API/browser suite | Consent, atomic account creation, credential hashing, recovery, isolation, expiry/revocation, reload persistence and browser navigation. |
| Community matching | Independent ranking criteria, talent persistence, validation and account isolation; no raw health-data influence. |
| Watch/Care ingestion | Migrated in-memory database, scoped uploads, provenance, deduplication, permission revocation and suspension. |
| Interface rendering | 134 cumulative rendering assertions plus community-prefill, schedule/calendar and individual/organization form checks. |
| SQL invariants | Integrity, verification, upgrade, credit policy, scheduling and inquiry suites passed against isolated in-memory databases. |
| Task workflow HTTP | 133 assertions plus concurrency, two-person start/completion, conservation, disputes, recovery and privacy invariants against a fresh local Worker. |
| Native authentication HTTP | 15 checks covering bearer sessions, revocation, consent validation, profile persistence and private-field protection. |
| Partner HTTP | 79 checks for roles, training gates, badge revocation, budget conservation/rollback, capacity and verification expiry. |
| Care HTTP | 58 checks for owner isolation, review-gated records, summary snapshots, sharing/revocation, device permissions and Care deletion. |
| Care connections HTTP | 30 checks for consent, ownership, persistence, family contacts and edit conflicts. |
| Physical-note extraction | 9 deterministic validation checks. No live AI provider conversation was sent. |
| Native history storage | Swift checks passed for durable history, paging, sampling, account/backend separation, acknowledgements and explicit deletion. |
| Changed JavaScript tests | ESLint passed for the new demo tests and amended browser navigation test. |
| Patch whitespace | `git diff --check` passed. |
| Live website smoke check | After deployment, 13 member/Care/program destinations opened without uncaught page exceptions; a sample note was saved and edited in place. Only demo data was changed. |

### Corrected obsolete test fixtures

Earlier HTTP fixtures were inconsistent with current product behavior:

- A new unverified account was expected to reach insufficient-credit validation.
  The workflow now first proves verification denial, then verifies a synthetic
  zero-credit member and proves insufficient-credit denial.
- Native registration omitted account type/birth date and used invented service
  areas. It now supplies valid synthetic details while preserving denial,
  revocation and privacy assertions.
- The Care test expected all recommendations to disappear without Care consent.
  Current matching independently considers community preferences. The test now
  checks that the Care-specific recommendation reason appears only with consent.

The corrected suites were rerun successfully. Production permission checks were
not weakened to make the tests pass.

## Outstanding limitations and warnings

1. **Repository-wide lint is not clean.** The configured full lint command reports
   1,551 errors and 28,728 warnings, including generated output. A source-only
   check reports 491 errors and 80 warnings. Existing typing/hook/style debt was
   not mass-rewritten during this navigation/manual task. Passing builds and
   functional tests do not mean this backlog is resolved.

2. **Android native compilation is blocked.** Gradle 8.11.1 encounters
   `Unsupported class file major version 69` with the installed Java 25.
   No alternate compatible JDK or Android SDK was found in the checked standard
   locations. Use a compatible toolchain, normally JDK 21 for this Capacitor
   project, plus the required Android SDK, before attempting a native release.
   An Android device was not tested.

3. **The standalone simulator Keychain harness did not pass.** It failed to
   produce its expected success marker; a follow-up launch also failed.
   This is not proof of an application credential failure, but it means this
   audit cannot certify native Keychain persistence. The main app compiled and
   launched; bearer-token server tests passed. Physical-device sign-in/restart/
   recovery remains a separate check.

4. **Physical watch/background reliability remains unverified.** Simulated BLE
   and native-storage tests do not prove real radio delivery while locked,
   Bluetooth-off recovery, phone/watch restart, force-quit behavior or watch
   firmware timing. A powered-off watch cannot send data.

5. **Production authenticated workflows were not exercised with real member data.**
   Backend write tests used disposable local accounts/databases. Live site checks
   used demo mode. A supervised release check with consented test accounts is
   still needed for real sign-in, task creation and cross-device saved records.

6. **Platform integrations need hands-on checks.** Microphone permissions,
   browser speech services, real calls, downloaded files/calendar imports and
   locked-phone reminders vary by OS/browser. Live AI-provider behavior, provider
   billing tier and live message quality were not tested.

7. **Build warnings remain.** Both web/mobile builds warn about large bundles;
   the mobile JavaScript entry is approximately 4.16 MB minified / 1.38 MB gzip.
   The web framework also reports a static route-classification limitation.
   These did not fail compilation but warrant performance testing on slower devices.

## Recommended physical release checklist

Use consenting test accounts, not another member's records.

1. Install the updated signed app after the owner approves installation.
2. Sign in, restart, verify the same account and preferences, then test sign-out
   and recovery. Keep recovery codes private.
3. Use two verified test members to create, accept, agree, start, finish and
   confirm one short task; inspect both balances.
4. Save/edit a private Care note; confirm it is absent from the other account.
   Share only a synthetic summary, then revoke it.
5. Pair the physical watch. With Wi-Fi/mobile data off, check fresh Bluetooth
   timestamps. Power off the watch and confirm loss is not presented as fresh data.
6. Test supported background sensing through at least two scheduled sessions;
   compare original receipt timestamps and retained on-phone history.
7. Restore internet with cloud saving opted in. Confirm uploads, then stop saving,
   disconnect and switch accounts to check opt-out/isolation.
8. Test denied microphone/Bluetooth permissions, calendar import and app restart.
   Do not mistake a simulated test or a successful compile for these results.

See the [operating manual](OPERATING_MANUAL.md) for user-facing steps.
