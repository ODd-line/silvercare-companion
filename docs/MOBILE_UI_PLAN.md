# Mobile UI improvement plan

Status: implemented locally on 26 October 2026. Source and bundled iOS assets are prepared for the next Mac build; the installed iPhone app has not been updated.

## Goal

Make useful content appear sooner on a phone. Keep short labels, clear icons, accessible info buttons, and readable controls for older users.

## 1. Community layout and demo notice — first priority

- Replace the large demo notice with a persistent **Demo · Sample data** badge and an info button. The popup keeps the existing explanation about temporary changes, accounts, bookings, and notifications.
- Keep **Ask for help** as the main action. Put **My talents** and **Programs** together in a compact secondary row.
- Reduce gaps between the heading, actions, navigation, and filters. Keep enough bottom padding to scroll content above the floating dock.
- Use the existing info-button component and current visual style.

Primary files: [app page](../app/page.tsx), [shared styles](../app/globals.css), [info button](../components/care-info.tsx).

Acceptance: at 390 × 844, the first task or actionable empty state appears without scrolling past a large block of controls. Demo identity stays visible, with all details available in one tap.

## 2. Community tabs and empty states

- Show three main tabs: **Browse**, **For you**, **My activity**.
- Under **My activity**, provide **Helping** and **Requested** choices.
- Retain the existing internal views (`available`, `recommended`, `helping`, `requested`) and account-specific preferences. Derive the main tab from the saved view so reloads and navigation still restore the correct list.
- Keep filters available where they already apply. Switching views must preserve filters.
- Give empty screens a useful action: **Clear filters** when filters exclude results, **Browse all** for an empty nearby list, or **Ask for help** when no requests exist.
- Use “No requests found” unless a location filter actually supports the more specific “No nearby requests.”

Primary files: [app page](../app/page.tsx), [home dashboard](../components/home-dashboard.tsx), [preferences](../lib/preferences.ts).

Acceptance: all three main tabs fit a 320-pixel viewport without horizontal scrolling. Every previous task view remains reachable, including after a reload. Empty-state actions perform exactly the filter or navigation change their label describes.

## 3. Sharper branding and consistent controls

- Replace the tiny header JPEG with a crisp, scalable Silver⁺ mark using SVG or styled text.
- Keep an accessible brand name and the existing introduction link.
- Standardize heading spacing, icon sizes, and primary/secondary button styles.
- Keep the bottom dock icon-only, with clear selected state and accessible names.
- Retain at least 44 × 44-pixel tap targets and visible keyboard focus. Translate new labels into the existing supported languages.

Primary files: [brand component](../components/silver-landing.tsx), [app styles](../app/globals.css), [translations](../lib/translations.json).

## 4. Care summaries

- Put the latest heart rate, steps, and last-update time before the graphs.
- Use compact summary cards, with graphs and full reading details below.
- Keep units, missing/stale states, and the distinction between step-counter readings and daily totals clear.
- Preserve the distinction between live watch readings and saved observations. Continue using info buttons for supporting explanations.

Primary files: [watch history](../components/watch-history.tsx), [My Watch](../components/pinetime-watch.tsx), [Care styles](../app/silver-care.css).

## Validation and delivery

- Check 320-, 390-, 430-, and 1280-pixel layouts, larger text, and bottom safe-area spacing.
- Exercise task views, filters, saved preferences, account changes, empty-state actions, info popovers, and keyboard focus using local fixtures with empty and populated lists.
- Keep consent controls, error messages, stale-reading indicators, and sharing/deletion confirmations visible at the relevant action.
- Run the mobile build, TypeScript checks, and affected navigation/watch tests. Update obsolete text selectors while preserving behavioral assertions.
- Refresh the local preview and copy the finished source and bundled iOS assets into the Downloads project.
- Build, sign, and install the iPhone update when the remote Mac is available. Local preview changes alone do not update the installed phone app.

## Completed implementation and verification

- Added a persistent demo badge with accessible details, paired secondary Community actions, and the three-tab Community browser. Activity subviews retain their existing account-specific saved values.
- Added working clear-filter, clear-search, browse-all, and ask-for-help empty-state actions. Browsing all intentionally resets task filters; ordinary tab switching preserves them.
- Replaced the shared header mark with a scalable Silver⁺ SVG. The bottom dock remains icon-only.
- Moved saved heart-rate and step-counter cards before the graphs. My Watch shows heart rate and steps before battery and advanced options, retaining existing freshness and consent behavior.
- Added 26 translation entries covering all four non-English languages. Added responsive wrapping and card stacking for larger text.
- Mobile production build and TypeScript checks passed; editor diagnostics were clear. The build retains its existing large-bundle warning.
- Navigation regression tests passed, including saved filters/views, account guards, Care menu focus, check-in saving and recommendation handoff. Updated the email-settings test fixture to supply its required settings response.
- Watch browser regression tests passed, including live/stale readings, reconnection, separate storage consent, background history and account cleanup. Reading tests now identify channels rather than their old display order.
- Verified 320-, 390-, 430-, and 1280-pixel layouts; all five Community languages at 320 pixels and 200% text; enlarged-text Care screens and help panels; empty and populated task layouts; and scrolling content clear of the bottom dock.
- Checked that both saved-reading cards precede the graphs and that demo disclosure opens, closes, and restores keyboard focus.

## Timeline follow-up — 27 October 2026

- Replaced the separate notes and device lists on Timeline with a chronological day view. Today opens first; when today has no entries, the newest available day opens.
- Combined readings only when their device ID, exact timestamp, timestamp source and sample-data status match. Unknown devices or timestamps remain separate; every reading retains its own value and unit.
- Added All, Heart, Steps and Notes filters, a date picker, clear-filter actions and batches of older days.
- Added daily heart-rate averages and dot graphs using valid saved observations. Missing intervals remain gaps; step counters are never summed into daily totals.
- Reading details preserve device name, exact time and timestamp provenance. Notes retain full details, editing, deletion confirmation, error handling and retry.
- The view uses the existing API window: up to 500 notes and 500 device readings. This limit is explained in Timeline’s info panel; an empty date does not claim no older records exist on the server.
- Added `test:timeline` and `test:timeline:web` scripts. Grouping, local dates, daylight-saving boundaries, filters, invalid values, editing, confirmed deletion and retry passed. Existing navigation tests, TypeScript and the mobile build also passed.
- Checked four viewport sizes and all five languages with normal and enlarged text. The bundled iOS update is prepared for installation through the Mac.
