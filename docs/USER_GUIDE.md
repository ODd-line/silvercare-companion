# Silver Bank + Silver Care: quick start

[README](../README.md) | [Complete operating manual](OPERATING_MANUAL.md)

This is the same shared interface as the installed Silver Bank iPhone app.
It is not the previous Expo companion's practice ledger.

## Choose the right mode

| Mode | What happens |
| --- | --- |
| Sign in / create account | Uses real accounts and records on the selected backend |
| Continue as guest | Creates a real server-backed account; keep its private recovery code |
| Try demo without signing in | Uses sample data in memory; no real transactions or health uploads |
| Use watch without internet | Native Bluetooth-only mode, without account/cloud access; local history is separately opt-in where supported |
| Local developer preview | The actual app UI with sample API fixtures, not a live community |

Keep passwords and recovery codes private. Lost guest codes cannot be retrieved.
Guest accounts are not automatically verified or granted Time Credit.

## Navigation

The bottom dock contains **Home**, **Community**, **Care**, **Time Bank**, and
**Profile**.

- Home and Community offer requests, ways to help, matching, and talents.
- Time Bank shows available/reserved time and activity.
- Profile contains personal settings, verification, and sign-out.
- Care opens a menu: **Overview**, **My Health**, **AI chat**, **Timeline**,
  **My Watch**, **Appointments**, **Family**, and **Care settings**.

Private Care requires an individual account and its own consent. Organization
and partner workspaces have different permissions and navigation.

## Try the interface safely

1. On Sign In, choose **Try demo without signing in**.
2. Visit the five main dock destinations.
3. Open **Care > Overview**, choose a sample check-in response, then explicitly
   save it privately.
4. Inspect **Timeline** and the labelled sample graphs in **My Health**.
5. Visit the other Care sections without expecting real bookings, calls,
   AI processing, sharing, or device uploads.
6. Use **Exit demo** to discard sample changes.

For a developer-run preview, open `http://localhost:3042/#care/overview` after
`npm run preview:app`. It uses the same UI but its own restricted sample API.

## Real accounts and tasks

Complete the profile, agreements, and required verification before participating.
Review the task's duration, date, meeting details, and reservation before posting
or accepting. Follow the readiness, finish, and confirmation controls; a pending
task is not a completed transfer. Use the operating manual for disputes, partner
roles, programs, and account recovery.

Do not confuse a guest with a demo: a guest can save real private records and
participate when the account meets the normal requirements.

## Watch and private records

On a native build, open **Care > My Watch** (or the offline-watch entry), allow
Bluetooth reception, and connect a compatible PineTime/Mastro watch.

- Bluetooth reception does not automatically authorize cloud saving.
- Select the permitted categories and explicitly start saving for cloud records.
- Local iOS history and background receipt have separate controls and limits.
- Revoke receive/save consent or disconnect to stop the corresponding activity.
- A stale value, dark screen, or connection icon is not proof of a fresh
  measurement or continuous monitoring.

See the [watch guide](PINETIME_WATCH.md) for supported firmware, opt-ins,
reconnection, history, and remaining physical-device tests.

## iPhone launch problems

| Message | Action |
| --- | --- |
| Developer Mode Required | Settings > Privacy & Security > Developer Mode; enable, restart, and confirm |
| Untrusted Developer | Settings > General > VPN & Device Management; trust the intended developer profile while online |
| App Is No Longer Available | Development provisioning may have expired; renew signing and install an update without uninstalling |

Free Apple development provisioning commonly expires after seven days.
TestFlight/App Store distribution requires its own signed release workflow.
Do not delete the app as the first troubleshooting step: local-only watch
history can be lost. A GitHub push does not renew signing.

For urgent medical concerns, contact local emergency services. Saving a check-in
or family contact does not dispatch help.
