# SilverCare custom domain

Status: 25 October 2026, Cloudflare activated at 13:03 UTC (21:03 Hong Kong). The universal HTTPS certificate is active. At 13:38 UTC, `https://www.silvercare.care` returned HTTP 200 and loaded the real app in the shared browser. Public DNS returns Cloudflare addresses for the root domain, and HTTPS to those addresses with the root hostname also returns HTTP 200. The local resolver still returns the old parking IP for the root domain, even after clearing the Windows DNS cache; use the working `www` address while this cache expires.

## Completed

- Added `silvercare.care` to the existing Cloudflare account on the Free plan. The registration remains at Namecheap.
- Cloudflare zone ID: `a2d375225734ba98cae7ee7c142d195e`.
- Connected `silvercare.care` and `www.silvercare.care` as custom domains on the existing `silver-bank` production Worker. Certificate provisioning was requested by Cloudflare.
- Recorded both custom domains in [deployment configuration](../cloudflare.deploy.json). The Workers URL remains enabled for existing links and installed clients.
- Removed imported Namecheap parking A/CNAME records in the new Cloudflare zone. Custom-domain bindings created the proxied website records.
- Preserved Private Email MX records (mx1/mx2.privateemail.com, priority 10), root SPF, autoconfig/autodiscover/mail CNAMEs, and the autodiscover SRV record.
- Preserved Resend DKIM and DMARC. Manually added the two Resend CNAMEs missed by Cloudflare's scan: `rsend` → `rsend-apne1.forge.rmta.net`, `send` → `send.forge.rmta.net`.
- All email CNAMEs use **DNS only**, correcting the scan's default proxying of Private Email hosts. Direct queries to Cloudflare's assigned nameserver confirmed MX and Resend CNAME answers.
- Disabled Bot Preference Sync during onboarding to avoid modifying the app's robots.txt.

## Registrar change completed

After the user signed in again, Custom DNS was saved in Namecheap and verified after reloading the domain settings. Cloudflare onboarding was completed and its **Check nameservers now** action was triggered.

The saved nameservers are:

```text
casey.ns.cloudflare.com
tessa.ns.cloudflare.com
```

Previous delegation: `pdns1.registrar-servers.com`, `pdns2.registrar-servers.com`. DNSSEC was off and no DS record was returned at preparation time. At the immediate post-change check, public resolvers 1.1.1.1 and 8.8.8.8 still returned this previous delegation, Cloudflare reported `pending`, and HTTPS did not connect. Cloudflare estimates 1–2 hours, sometimes up to 24 hours; Namecheap advises allowing up to 48 hours. No further registrar edit is needed.

## After nameserver change

1. Cloudflare activation, public delegation, and the HTTPS certificate are confirmed. The `www` hostname loads the app normally. Confirm the root hostname also loads through the local resolver once its old parking answer expires. Preserve the old Workers URL.
2. Confirm the Resend domain remains verified and mail DNS answers match the intended records.
3. Once HTTPS works, change `CARE_EMAIL_APP_URL` to `https://silvercare.care` in [deployment configuration](../cloudflare.deploy.json) and [.env.example](../.env.example), rebuild and deploy. The value intentionally remains on the working Workers URL until then.
4. Update the existing [Resend webhook](https://resend.com/webhooks/863c83ba-7b94-412a-b0c3-5218f027a6bd) endpoint to `https://silvercare.care/api/care-email-webhook`, preserving its events and signing secret. Check signed and tampered callback behavior again.
5. Update the email operating docs to use the custom domain. New native builds can adopt the custom API origin after it is working; currently installed builds keep using the supported Workers URL.

DNS propagation and certificate issuance can take time. Do not mark the custom domain live based only on a successful configuration save. Sessions are host-specific, so users may need to sign in again on the new domain.
