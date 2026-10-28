# Weekly email deployment

## Deployment status — 25 October 2026

The sending domain `silvercare.care` is verified in Resend. GitHub account `ODd-line` provided access to the existing Cloudflare account. The production database was backed up, migration 0018 applied, and the app deployed to Worker `silver-bank` with its existing D1 `silver-bank-db`. Both Resend secrets are installed. The webhook is enabled for bounced/complained events and passed signed/tampered payload checks. Real inbox delivery still awaits an approved test recipient.

The deployment steps below are a runbook for subsequent installs. Do not recreate the existing API key or webhook unnecessarily.

Use Node 22.13+ and installed project dependencies. This workspace includes Node under `work/video/node-v22.22.0-win-x64`; add it to PATH for PowerShell commands if needed. Authenticate Wrangler to the correct Cloudflare account before remote operations.

## Deploy with delivery disabled

1. Confirm the account/Worker/database in [cloudflare.deploy.json](../cloudflare.deploy.json) match production. Keep `CARE_EMAIL_ENABLED` set to `"false"`.
2. Review pending migrations with `npx wrangler d1 migrations list silver-bank-db --remote --config cloudflare.deploy.json`. Apply reviewed pending migrations with `npm run db:migrate:cloudflare`. This feature adds `0018_care_weekly_email.sql`; preserve existing data.
3. Build in PowerShell with `$env:SILVER_BANK_HOSTING = 'cloudflare'`, then `npm run build`.
4. Deploy with `npx wrangler deploy --config dist/server/wrangler.json`.

## Configure Resend

1. Create a sending-only API key restricted to `silvercare.care`. Install it with `npx wrangler secret put RESEND_API_KEY --config dist/server/wrangler.json`. Enter it only into the secret prompt, not chat, source code, or shell arguments.
2. Add a Resend webhook at `https://silver-bank.s20181076-cfd.workers.dev/api/care-email-webhook`, subscribing to `email.bounced` and `email.complained`. Update the origin if production differs.
3. Install its signing secret with `npx wrangler secret put RESEND_WEBHOOK_SECRET --config dist/server/wrangler.json`.
4. Confirm `CARE_EMAIL_FROM` is `SilverCare <updates@silvercare.care>` and `CARE_EMAIL_APP_URL` is the public HTTPS app origin for health/unsubscribe links. The custom domain is connected to the Worker and its Namecheap nameservers have been switched to Cloudflare; activation is pending DNS propagation. Keep the working Workers origin for app links and the webhook until custom-domain HTTPS is verified. See [custom domain status](CUSTOM_DOMAIN_SETUP.md).
5. Once the endpoint, secrets, migration and domain are verified, set `CARE_EMAIL_ENABLED` to `"true"` in deployment configuration, rebuild and deploy. Sending requires enabled=true, both secrets, sender, and valid HTTPS origin.

The server renders HTML and plain text directly, rather than using the saved Resend dashboard draft. Publishing the draft is unnecessary. Gmail recipients do not need to connect Gmail to the app.

## Controlled delivery check

Use a user-approved test account and recipient. In Settings, request and verify an email code, select report sections, and explicitly opt in. Inspect messages in desktop/mobile Gmail, including spam folders. Resend acceptance does not guarantee inbox placement. Check unsubscribe and signed bounce/complaint callbacks. No real messages were sent during implementation.

## Schedule and operational limits

- Cron `0 * * * *` runs hourly. Summaries cover the previous Monday 00:00 through current Monday 00:00 in Hong Kong. Delivery starts Monday 09:00 HK, subject to batches and provider availability. Opt-in after cutoff starts next week.
- Each invocation queues up to 25 new recipients and processes up to 25 attempts. The 23-hour creation window supports at most 575 new reports per week before retries/provider failures reduce capacity. Add scalable queue/batch processing before wider rollout; monitor opted-in counts and pending/expired status.
- A unique user/week row and stable Resend idempotency key prevent duplicate submissions. Five-minute leases protect concurrent runs. Retries stop before Resend's 24-hour idempotency expiry.
- Selected aggregate payloads remain immutable while retrying and clear on success, cancellation or expiry. Old payload cleanup runs after seven days. Delivery metadata remains until care-data erasure. Do not log message bodies, codes, tokens, or keys.
- Bounce/complaint callbacks require a raw-body Svix signature and timestamp within five minutes. They disable the matching subscription revision. A later settings revision is not automatically disabled by an older report callback; investigate Resend suppression failures if delivery stops.
- To stop new delivery, set `CARE_EMAIL_ENABLED` to `"false"` and redeploy. Users can still turn off preferences and unsubscribe.

## Local validation

`npm run test:care-email` uses SQLite in memory and mocked transport; it cannot send messages. `npx tsc --noEmit` checks types. The local demo at `http://127.0.0.1:3046/#care/settings` uses synthetic data with delivery disabled. Real account integration and production delivery still need checking after deployment.

## Daily graph update — 25 October 2026

Daily heart-rate averages, check-in markers and saved-note counts now appear in both the selected-section preview and newly generated weekly email reports. Bars use inline HTML tables, require no remote images or scripts, and include readable values. Missing heart-rate days remain missing. Dates use Hong Kong time, and source records remain owner-scoped. No schema migration was needed. Deployed Worker: 699effe9-1366-4c87-b905-daa71d54d931. All 12 email tests, TypeScript and the Cloudflare build passed; production returned HTTP 200. No real email was sent during this update. Existing inbox and queued messages are unchanged.
