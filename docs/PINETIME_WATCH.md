# Silver Bank 1.6: PineTime connection

Native iOS and Android apps now include a real Capacitor BLE receiver in
Silver Care > My Watch. The ordinary website does not offer Bluetooth pairing.
App code, native projects, and tests belong in this application repository
(`ODd-line/silvercare-companion`), not in the watch firmware repository.
Generated release packages remain local and are not source files.

## Connection

1. Install the native app. Sign in to an individual Silver Care account, or choose
   **Use watch without internet** from startup/login for a Bluetooth-only session.
2. Private-records consent is needed for account storage, not for live Bluetooth.
3. Open My Watch, allow readings and automatic reconnection, and select Connect watch.
4. Grant the operating system's Bluetooth permission and select your PineTime.
5. Battery and steps are read initially and refreshed every 15 seconds while
  connected. Battery also uses notifications. Heart-rate values arrive by notifications
   while measurement is active on the watch. Open SilverCare or Heart Rate on the
   watch to start its existing measurement workflow.
6. Disconnect or revoke the receive checkbox to stop receiving, clear live readings,
   and disable future automatic reconnection and uploads.
7. Optional: enable private account storage, choose Steps and/or Heart Rate,
   then select Start saving. This is separate consent from Bluetooth receipt.
   A confirmed upload appears in My Health and Timeline for the same member.

Bluetooth reception and reconnection do not use Wi-Fi, cellular data, or the account
API. My Watch remains available if account records cannot load. The separate offline
screen can open even when initial authentication requests are pending or fail.
It shows only real Bluetooth readings, never demo data or cached private account
records. Live values clear on exit. iOS build 12 adds opt-in protected on-phone
history, stored under a separate offline scope, with no cloud upload or automatic
import into a signed-in account. Without that opt-in, readings remain session-only.
Cloud storage retains its independent consent and connectivity requirements.

By default, keep the phone app in the foreground with Bluetooth enabled. Build 12
and Mastro 0.1.13 add explicitly enabled background reception, described below.
A dark display is not a powered-off watch. This is not continuous monitoring.

Battery uses service 180F/characteristic 2A19. Heart rate uses 180D/2A37, with
standard 8-bit/16-bit decoding and contact validation. Steps use InfiniTime
service `00030000-78fc-48fe-8e23-433b3a1942d0`, characteristic
`00030001-78fc-48fe-8e23-433b3a1942d0`, unsigned 32-bit little-endian.
Raw motion is never subscribed to. Cached heart-rate reads are not interpreted
as new measurements; recent heart rate becomes unavailable after 15 seconds
without another notification. Received times are phone receipt times, not
sensor acquisition times. Readings are unverified observations, not diagnoses.

For BLE heart-rate devices that advertise sensor-contact support, a packet
explicitly reporting no contact is treated as unavailable, not as a pulse. A
zero value is also unavailable. Mastro OS 0.1.11 sends a zero pulse packet when
its sensor has insufficient data, but does not send BLE contact-status flags;
the app therefore cannot reliably distinguish a removed watch from a stopped
measurement, poor optical contact, or another missing-reading cause. The app
can request bounded heart-rate sessions with the optional Mastro 0.1.12 control
characteristic described below. Older firmware still requires starting a
measurement on the watch; enabling notifications alone does not activate its sensor.

## Automatic periodic sensing

This feature requires both the updated app (iOS build 11) and Mastro
0.1.12. It is **off by default** and separate from permission to receive or upload.
Enable **Automatically measure heart rate every 15 minutes** in My Watch once
the compatible firmware is installed and Bluetooth pairing is complete.

The first eligible foreground connection requests a session. The watch warms
up, then requires ten seconds of positive PPG analysis results with no invalid
analysis or gap longer than 1.5 seconds. The complete session is capped at
60 seconds, including warm-up. A failed window reports no reading, not a
replayed BPM. These are firmware-estimated observations, not a medical accuracy
guarantee. Partial fresh observations can arrive before a full window completes.
The current algorithm needs 64 samples (approximately 6.4 seconds) before its
first analysis, so a ten-second total session was intentionally not used.

The phone schedules requests during its existing foreground refresh cycle;
the watch independently enforces a minimum 900 seconds between accepted starts,
including across phone reconnections. Returning to the foreground can resume
an eligible schedule, but missed sessions are not backfilled. Watch reboot resets
its volatile cooldown. The display may sleep during a remote session without
forcing it to remain illuminated. Remote expiry/cancellation does not stop a
separate awake, manually requested session. The watch's Heart Rate Stop button
also cancels the current remote session; disabling future scheduled sessions is
done in the phone app. Disconnect, notification unsubscribe, account change,
backgrounding without the new background opt-in, or disabling the option stops remote sensing; the independent
firmware deadline remains the fallback if transport is lost.

Heart Rate service `180D` adds vendor characteristic
`7c9a1013-6f52-4f18-a3d1-8f3d3a79c001`:

- Read: four bytes `[version=1, phase, cooldownSecondsLo, cooldownSecondsHi]`.
  Phases: 0 idle, 1 queued, 2 warming, 3 collecting, 4 complete, 5 no reading,
  6 cancelled. Cooldown is little-endian, 0 through 900 seconds.
- Write with response: `[1,1]` requests a session; `[1,0]` cancels it.
  Writes require encrypted, authenticated BLE pairing; start also requires an
  active heart-rate notification subscription. Invalid commands, full queues,
  active sessions and cooldown starts are rejected.
- Only the standard `2A37` notification carries BPM. Each new positive analysis
  is notified even if its number matches the previous result. Cached reads and
  control status are never converted into health measurements.

Unsupported firmware, malformed capability responses and pairing/write errors
are shown explicitly without dropping battery/step reception or retrying commands
indefinitely. Retry automatic sensing is explicit. Do not extend the live-reading
freshness interval to conceal the deliberate gaps between scheduled sessions.
After a firmware update, a stale iOS GATT cache may require forgetting/re-pairing
the watch.

iOS build 11 installation was verified on the connected iPhone. The user confirmed
OTA installation of Mastro 0.1.12 and a completed sensing session with new BPM
readings. Screen-dark operation, subsequent 15-minute cycles, cooldown across
reconnection, cancellation, sensor shutdown, unchanged-BPM notifications and
battery behavior still require physical verification. The user subsequently
confirmed that 0.1.12 was already validated before updating to 0.1.13.
The live website now includes the sensing and history changes below.

### Locked-phone sensing and durable history (build 12 / Mastro 0.1.13 candidate)

iOS build 12 is installed and verified on the connected iPhone, preserving app
data. The matching backend and website were deployed on 2026-10-18 as Worker
version `c4a001f6-970c-4f59-857f-8eb31eeaa889`; the live app returned HTTP 200.
The user confirmed successful OTA installation and reboot into Mastro 0.1.13
after checking that 0.1.12 was validated. Validation of the new image remains
pending; locked-phone reception and retained history still require physical
verification.

Version 0.1.13 returns
`[2,phase,cooldownLo,cooldownHi,scheduled]` (five bytes; `scheduled` is 0 or 1).
Authenticated `[2,2]` enables the watch-owned schedule, including during cooldown.
Legacy `[1,1]` still requests one bounded session and `[1,0]` stops both the current
remote session and scheduling. The app accepts version 1 for foreground-only
sensing; background opt-in explicitly rejects it.

The heart task wakes at the next eligible 15-minute interval without a phone
timer. It keeps the same warm-up, ten-second usable window and 60-second deadline.
Unsubscription, disconnection, phone opt-out or watch reboot clears the schedule.
Local Heart Rate Stop and SilverCare cleanup cancel the current remote window,
not the phone's future schedule; this preserves existing foreground behavior.
The phone may re-arm a cleared schedule during an enabled foreground session.
Cancellation that preempts automatic queuing invalidates the queued start.

The iPhone declares `bluetooth-central`. After native storage permission and the
authenticated schedule command succeed, the UI reports **Background sensing is
armed**. Only then may visibility changes preserve BLE. Core Bluetooth receives
and records values natively; suspended JavaScript is not the scheduler or recorder.
The watch must stay powered, connected and nearby. Force-quitting, iOS termination,
radio loss and reboot are not covered by automatic background reconnection or
state restoration: reopen Silver Bank to reconnect. No background cloud upload
or uninterrupted monitoring guarantee is made.

The separately remembered `backgroundHistory` opt-in defaults false. Receipt
history uses per-server/per-account SQLite databases in Application Support,
protected on iOS with Complete Until First User Authentication file protection
and excluded from backups. There is **no age-based deletion or rolling record
cap**. Disk/open/write failures are logged without health values and reported on
the history panel; they do not become fabricated or confirmed observations.
App deletion or device loss can lose local-only history.

Native sampling stores at most one positive heart-rate observation and one
step-counter observation per 30 seconds, not raw PPG. Steps are stored when read;
they are not continuously requested in the background. Native phone receipt time
and a durable `sb-local:` UUID stay unchanged. Background bridge notifications
are not replayed as live readings, and delayed foreground notifications carry
their original native timestamp.

My Watch includes an on-phone graph and exact-value table, paged at 200 records.
**All dates (this page)** and **Older records** expose older observations without
loading the entire archive or claiming an aggregate graph of it. The range choice
is remembered. Explicit local deletion does not erase cloud copies or disable
future collection.

With separate Care setup, cloud-saving consent and category selection, foreground
sync sends pending records in batches of 60, including older history. Confirmation
marks them uploaded without deleting local records. Interrupted/failed uploads
retain them for retry. The backend deduplicates `sb-local:` receipt IDs per owner
across fresh upload adapters; ordinary device-scoped IDs retain existing behavior.
The backend change and `drizzle/0017_watch_history_receipts.sql` were deployed to
the owner's Worker/D1 on 2026-10-18; a remote migration check confirmed no pending
migrations. Keep background history off until the required watch firmware is
installed. The index keeps long-lived archives from requiring a full
history scan on each retry. The legacy five-minute memory-queue expiry does not apply to this
durable history.

Validation: `bash scripts/test-watch-history-native.sh` tests real SQLite
reopening, old records, paging, sampling, acknowledgement and account/server
isolation. Watch unit/browser and Care ingestion tests cover the protocol,
background visibility, consent and cross-adapter deduplication. Physical
locked-phone cycles and protected storage while locked still require testing.

## Live wellbeing view

The connection status distinguishes Bluetooth initialization, watch selection,
connection/service discovery, notification setup, and initial reads. On iOS,
the plugin combines radio connection and GATT discovery in one operation; the
app does not claim to observe those two stages separately. Connected appears
only after the required setup and initial battery/step reads complete.

My Watch shows large, unit-labelled battery, watch step count and recent heart
rate readings. Receipt-age labels identify when the phone received a packet,
with the full receipt time available on the time element. An expired heart-rate
value is replaced by an unavailable state and is excluded from the summary.
Battery uses a labelled percentage meter, not a health-risk score.

A failed battery or step refresh retains the last successful value and original
receipt time, with Update failed and Stale reading labels. Each channel recovers
independently; an unrelated notification cannot clear its warning. Battery/step
observations also become stale after 30 seconds without a successful receipt.
Stale values do not show live meters or goal achievements and are not sampled
as new uploads. A later valid receipt restores the channel's live state.

Users may enter an optional whole-number step-count goal from 1 to 100,000.
There is no prescribed default or medical recommendation. The progress meter
compares the watch's current counter with the chosen value; it does not establish
a daily total, count only steps taken after connection, or award Time Credits.
The goal is remembered locally for this account and server, alongside the selected
watch and category choices. Disconnecting keeps the goal but hides live progress.
Other accounts do not inherit it. Reset saved options removes it.

At a glance summarizes only available readings and whether the actual counter
has reached the chosen goal. It does not diagnose conditions, classify heart
rate as healthy/unhealthy, or infer an emergency from missing measurements.

No heart-rate notification is never presented as 0 bpm or proof of a medical
event. Step-counter snapshots can support a future, explicitly configured
no-steps-for-a-period check while the watch is connected, but unchanged steps do
not prove that a person is motionless: they may be resting, asleep, moving
without steps, wearing the watch loosely, or outside Bluetooth range. Any
wellbeing check-in or caregiver alert needs separate consent, availability and
delivery handling, and must not be described as emergency detection.

Historical charts, daily reset/timezone handling, automatic caregiver sharing
and sensor-derived activity recommendations are not implemented. Private saved
observations use the existing owner-scoped Care storage after separate consent.

## Private account upload

Saving is off by default. The private-storage setup must be complete and the
phone must be in the foreground. Legacy live-only storage requires an active
watch connection; native retained history can upload without one. Start saving enrolls an
adapter through authenticated `POST /api/care/connect`, scoped to the expected
member ID and only the selected `steps`/`heart_rate` categories. The adapter key
stays in memory; it is not placed in URLs, localStorage, logs or the UI.

`POST /api/care-device` uses that key and a member-ID guard. Each observation has
a stable UUID reused across retries, an ISO phone receipt time and
`timestampSource: phone_received`. Only fresh, range-valid observations are
sampled, at most once per metric per 30 seconds. Battery and activity minutes
are not uploaded. Steps are counter snapshots, never summed into daily totals.

The in-memory unsaved queue is capped at 60 observations; records older than
five minutes are discarded with a visible count. Three consecutive failed
attempts pause automatic uploads until Retry sync; automatic attempts back off
and enrollment/upload requests abort after 15 seconds. Saved is shown only after a
valid server acknowledgement; a duplicate retry may legitimately insert zero
additional rows. Offline or failed uploads are not labelled saved.

Stop saving, manual Bluetooth disconnect, account change or unmount aborts
pending uploads and clears the key/queue. Revoking the remote adapter is attempted
as well. If offline or already signed out, remote revocation may not complete;
use Private-records adapters to revoke it after signing in again. Already accepted
server writes cannot be undone by cancelling a request. Stopping future uploads
does not erase earlier records; Settings erases cloud Care data, while My Watch
separately deletes on-phone history.

Start saving also remembers the selected categories, consent, and enabled state
on this device for this account and backend. On restart or foreground return,
the app reconnects to the remembered watch and enrolls a fresh upload adapter
through the authenticated API. Enrollment failures remain visible and do not
loop; Start saving retries enrollment, while Retry sync retries pending uploads.
Returning online or to the foreground also permits a retry. Stop saving persists
the disabled state; simply leaving My Watch does not revoke permission.

Saved readings remain private and are available through the existing owner-only
Care API, My Health and Timeline. They do not change Time Credits, grant family
access or feed activity recommendations. Existing explicit summary sharing and
chosen activity preferences remain separate workflows.

### Backend prerequisite

Deploy the matching backend code and apply `drizzle/0015_watch_receipt_source.sql`
through the existing database migration workflow before enabling this app build
against a backend. Drizzle journal/snapshot metadata accompanies the migration.
It adds `timestamp_source` with `unknown` for old observations; no old rows are
invented as sensor or phone measurements. This implementation does not deploy
the backend or apply migrations to production. An older server/database is not
verified as compatible with account uploads from this build.

## Privacy and lifecycle

Live values and upload credentials stay in memory. Non-reading preferences and
explicit choices are stored separately per account and backend. The new native
history opt-in additionally stores protected receipt records as described above.
No time-bank balance change or Help/check-in delivery is added. Saved account observations
follow existing Care erasure and summary-sharing controls. Watch consent does not
authorize caregiver access. Demo preferences stay in memory and real BLE/upload
activity is disabled in demo. The offline screen has its own device-local choices
and never enrolls an upload adapter.

Account changes and sign-out stop runtime activity and clear live readings.
The signed-in watch session survives ordinary tab navigation. Connections pause
when the app becomes hidden unless background sensing is armed. Cloud uploads
always pause; only BLE/native recording may continue.
Foreground return resumes eligible activity with remembered permission.
Reset saved options in Profile immediately disables
automatic activity and restores device-local defaults; server records and
server-saved privacy settings and existing on-phone history are not erased. Corrupt or unreadable preferences
disable automatic activity and show an error. Failed saves/reset attempts warn
that older permissions could return after restart.

Unexpected disconnects clear readings and trigger at most three foreground
reconnect attempts, without reopening the device picker. Device and
OS background behavior is not guaranteed; this is not a continuous monitoring
or emergency-delivery service. Pair only your own trusted watch.

The app supports existing InfiniTime/Mastro services, including battery/step
fallback reads when older firmware's notifications are unavailable. It deliberately
does not subscribe to step notifications: existing firmware can discard and leak
those packets on valid BLE handle zero. Automatic step reads avoid that path.
Actual
Bluetooth pairing and radio reliability still require a physical phone/watch.
An iOS simulator cannot test Bluetooth.

## Build and verify

```sh
npm ci
npm run test:watch
npm run test:watch:care
npm run test:watch:web
npx tsc --noEmit --incremental false
npm run mobile:build
npm run mobile:sync
npm run mobile:ios:sim
npm run mobile:package
```

The pinned BLE plugin is 7.3.2 for Capacitor 7. `mobile:sync` installs a reviewed
SPM wrapper from `vendor/bluetooth-le.Package.swift`, mechanically generates its
34 Swift bridge registrations from the upstream Objective-C method list, and
restores the legacy plugin's implicit Foundation/UIKit imports explicitly before
syncing both platforms. It fails if the plugin version changes unexpectedly.
The native simulator build uses non-Keychain package authorization for public
SPM downloads and retains ad-hoc signing/Keychain entitlements.

Each mobile build writes `watch-build.json` from Vite's resolved test-mode
setting. Packaging refuses diagnostic mode, missing/invalid metadata, and any
included diagnostic iOS simulator bundle or Android APK before modifying release
files. Rebuild older native artifacts with matching metadata before packaging.
To restore an account-enabled build, use `VITE_WATCH_TEST_MODE=false npm run
mobile:build`, run `npm run mobile:sync`, and rebuild the native artifacts. This
guard protects local packaging; it does not prevent manually installing a
diagnostic build for testing or validate physical Bluetooth compatibility.

The browser fixture covers delayed discovery, discovery failure/retry,
channel-specific refresh failure/recovery, retained timestamps, stale-value
upload exclusion, and responsive connection/error states. These are simulated
Bluetooth events, not CoreBluetooth radio tests.

Actual iOS 27 simulator execution exposed a startup trap in the older non-scene
app lifecycle. The app now declares a single storyboard-backed scene and forwards
scene URLs/user activities through Capacitor, preserving the secure-session
bridge. The rebuilt app was installed, launched, checked for a live process after
startup, and captured rendering its WebView. This is a native launch check, not
a Bluetooth radio test.

## Remaining verification

A physical iPhone test forms a link to the watch but service discovery has not
completed. nRF Connect on the same phone also reported no services; the root
cause is not established. The watch's information screen reports Mastro OS
0.1.11, reference `2105a7b`, bootloader 1.0.1. No telemetry has been verified from
these physical trials, and no firmware was flashed during app stabilization.

Backend setup/signup preflight previously returned Cloudflare 403 from the Mac;
the exact phone response and a correction remain unverified. Real account
enrollment/upload/retrieval still require the matching backend and migration.
The diagnostic build bypasses login and storage; its success is not evidence
of account integration. Before release, verify physical service discovery,
valid readings, reconnect/foreground recovery, and acknowledged private uploads
for the correct member. Automated mock tests alone do not meet that gate.

Version 1.6 uses Android version code 7 and iOS build number 7. Release artifacts
are written under `mobile-build/releases/1.6.0/`, with SHA-256 checksums. The
source ZIP excludes dependencies, caches, databases, environment secrets, and
generated assets. A simulator ZIP is not an iPhone installation package.
Android builds need an Android SDK and compatible JDK; signed iPhone distribution
needs the owner's Apple team/provisioning. No store deployment or remote push is
performed by these scripts.

## Physical acceptance

- Confirm the native Bluetooth plugin initializes without an unimplemented
  error; a denied permission is handled without claiming connection.
- Select the actual watch and compare battery and steps with its screen.
- Walk, then confirm steps arrive without tapping an update button.
- Start a watch heart-rate measurement; compare values and timestamps. Stop it
  and confirm stale heart rate is not presented as a current reading.
- Disable Bluetooth, move out of range, and return; verify bounded reconnect
  behavior and clearing of stale readings.
- Revoke consent, switch accounts and sign out; confirm no readings cross accounts
  and no further collection/uploads occur. Existing history remains owner-scoped.
- Arm background sensing, lock the phone for at least two 15-minute cycles with
  the watch display dark, then reopen. Confirm original receipt timestamps and
  retained history, no early duplicate sessions, bounded sensor shutdown, and no
  background cloud uploads. Test opt-out and system/radio-loss recovery separately.
- Existing account, bank ledger, private-records permissions, and family
  workflows must remain unchanged. Help on the watch remains local-only.