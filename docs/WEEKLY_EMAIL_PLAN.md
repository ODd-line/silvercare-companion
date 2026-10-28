# SilverCare weekly email summary

Updated 25 October 2026. The user requested implementation in the web app after the Gmail-style preview.

## Current status

- Implemented and deployed: email settings, selected report sections, recipient verification, opt-in, preview, weekly scheduling, unsubscribe, and signed bounce/complaint webhook handling.
- Resend confirms **silvercare.care is verified and ready to send**. DNS is no longer the blocker.
- Sender: `SilverCare <updates@silvercare.care>`. This does not create a receiving mailbox.
- Signing in through GitHub account `ODd-line` restored access to the correct Cloudflare account `fcfd7d74824736ac8352030d3de86a83` and its existing Worker/database.
- Backed up the production database and applied the sole pending migration, `0018_care_weekly_email.sql`. Deployed the updated app to the existing Worker, preserving its database and URL.
- Installed a sending-only Resend API key restricted to `silvercare.care`, plus the webhook signing secret, as Worker secrets. Temporary secret-transfer files were removed.
- Created the [Resend webhook](https://resend.com/webhooks/863c83ba-7b94-412a-b0c3-5218f027a6bd) for `email.bounced` and `email.complained`. A signed synthetic event returned 204; a tampered payload returned 401. No real delivery record was changed by this test.
- No real email has been sent. The user was asked to choose a recipient for one synthetic test email; response pending.
- Delivery is now enabled at the service level (`CARE_EMAIL_ENABLED=true`) in deployed version `15f0f653-f2de-4867-83ec-48f045879c55`; each recipient must still verify their email and opt in. Cron runs hourly, with reports due Mondays at 09:00 Hong Kong time.
- See [deployment steps](WEEKLY_EMAIL_SETUP.md) before enabling delivery.

## Implemented experience

SilverCare Settings contains “Your week, in your inbox.” A registered individual account verifies its own email using a six-digit code, selects sections, and explicitly enables weekly reports. Verification alone does not subscribe the user. Delivery starts off.

Reports cover the previous Monday–Sunday, using Asia/Hong_Kong throughout, and are scheduled from Monday at 09:00. Enabling after that cutoff starts the following Monday. The initial version uses a fixed schedule, rather than a selectable day or time zone.

Available sections are distinct check-in days, health-note count, and average/range/count of valid saved heart-rate readings. Queries use only the recipient's records. Missing readings are labelled; note text, chats, and family contacts are excluded. This version does not add appointment summaries or charts.

Emails include a private app link and unsubscribe link. Gmail is supported as a recipient inbox; no Gmail API connection is required. The decorative Gmail frame from the video is not part of the delivered message.

## Resend and DNS

- [Verified domain](https://resend.com/domains/aab70c12-4e9e-42c2-a4bc-fca3eadbacd2), Tokyo region `ap-northeast-1`.
- Namecheap PremiumDNS records: TXT `resend._domainkey` with generated public DKIM; CNAME `rsend` → `rsend-apne1.forge.rmta.net`; CNAME `send` → `send.forge.rmta.net`; TXT `_dmarc` → `v=DMARC1; p=none;`.
- Preserved Private Email configuration. Subsequently connected the app to `silvercare.care` and `www.silvercare.care`, copied mail records to Cloudflare, removed Cloudflare's imported parking records, and saved Cloudflare nameservers in Namecheap. Activation is pending propagation; app links and the webhook retain the working Workers origin until custom HTTPS is verified. See [custom domain status](CUSTOM_DOMAIN_SETUP.md).
- [SilverCare Weekly Health Summary template](https://resend.com/templates/7fb174ff-e0de-4729-8796-a05be1706c8f/editor) remains a draft. The implemented server renders its own HTML and plain text so unselected sections are omitted. Publishing the separate draft is not required.

## Validation and remaining work

Eleven isolated tests cover calculations, owner boundaries, verification, consent, overlapping runs, retry idempotency, unsubscribe, cutoff scheduling, and webhook signatures. TypeScript and the Cloudflare build pass. The local demo has been checked for section persistence, preview filtering, and mobile overflow. All transport calls in tests are mocked.

Remaining validation: a user-authorized real delivery test, Gmail rendering checks, and the complete authenticated account verification/opt-in flow. Deployment and webhook authentication have been checked; successful inbox delivery has not yet been demonstrated. Default subscriptions remain off for every user.

## Privacy boundaries

Only verified account recipients can opt in. A family contact does not grant permission to share health data. Reports describe saved observations, without diagnoses or continuous-monitoring claims. Email copies cannot be recalled. App links retain normal authentication. Care-data erasure also deletes email preferences, challenges, and delivery records.

## Earlier preview assets

- [Gmail-style report](../outputs/silvercare-intro/silvercare-email-preview.html)
- [Report image](../outputs/silvercare-intro/silvercare-email-preview.png)
- [Introduction without narration](../outputs/silvercare-intro/silvercare-intro-email-no-voice.mp4)

These generated files may not exist in a fresh checkout. Their figures are synthetic demonstration data.
