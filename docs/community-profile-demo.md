# Silver Plus interactive exploration module

Prepared for integration into the teammate's current Silver Bank/Silver Care repository. This folder is a local preview, not a deployment or replacement of the production application.

## Preview
Serve this folder with any static HTTP server and open index.html. For example, run `python3 -m http.server 8795` in this folder.

- Directory: `/`
- Member: `/?kind=member&id=mei-chan`
- NGO: `/?kind=ngo&id=hkfyg`

## Integration
Copy this folder into a dedicated static route, preserving its relative font and image paths. Existing directory buttons can link to the member and NGO URLs above; use the IDs in seed.mjs. This approach keeps all paths independent of the host app and is ready to adapt once its repository is available.

For direct mounting, import `mountSilverDemo` from demo.mjs and load styles.css. Call `mountSilverDemo(element, {initialKind:'member', initialId:'mei-chan'})`. The returned object exposes `open(kind,id)` and `destroy()`. In a React effect, call destroy on cleanup. If mounting directly into another route, resolve relative images/fonts against this module's asset directory.

## Behavior and isolation
15 fictional member experiences and 10 real NGO listings with fictional operational activity. No authentication impersonation, production writes, backend access, or email sending. Changes persist only in browser localStorage under silverplus-personas-v1. Reset affects this namespace only. NGO listings do not imply affiliation or endorsement.

Members can explore talents and transactions, post requests, accept help, chat with the other participant, submit completion, and switch persona to confirm time. Balances derive from the ledger and open requests reserve credits. NGO workspaces provide programmes, participation/completion, training badges, community needs and support approval within a finite fund.

## Visuals
Google Sans fonts; original community photo-card structure; Y-axis flipping, pointer tilt, glare and reduced-motion support; floating icon dock. 12 additional Pexels photographs expand activity coverage. photos.mjs records source/license URLs for photos; official NGO photos retain their source references. Stock images illustrate activities, not the identities of fictional members.

## Validation
Run `node test.mjs` to check ledger conservation, reservations, role checks, support budgets and badge prerequisites. Production authentication, route integration and shared storage require review against the teammate's actual source.
