# AirTruckers · Alaska Operations · Version 0.3

A browser-based aviation career and company management companion for Microsoft Flight Simulator 2020 on Xbox. Flights are flown in MSFS and reported manually here. No simulator telemetry, external AI service, backend or account is required.

## Run and validate

Use Node.js 22+ and npm (validated with Node 24).

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Vite prints the local development address; preview serves the production `dist` bundle. Use **HTTPS or localhost** with a current Safari, Chrome or Firefox: saving uses the Web Locks API to serialize writes across tabs. Safari supports Web Locks from version 15.4. A plain HTTP LAN address on an iPad is not a secure context and will refuse safe saving. For an actual iPad, use an HTTPS-hosted test copy. Native controls, 16px report inputs, explicit labels and responsive single-column forms support touch and Safari; real iPad acceptance testing is still required.

## Existing company functionality

Create a company at Kodiak (PADQ), with $25,000 and one fully owned Cessna 208B Grand Caravan EX. One owner/pilot has an informational salary of $65,000 annually ($2,500 per biweekly period, 26 periods/year). Renaming preserves all progress. Dashboard, Aircraft and Company Settings remain available; Finances is a future-feature placeholder.

Reputation starts at neutral 50/100; this release does not alter it. The operational clock starts at June 1, 2026 at 08:00 UTC and does not follow real time. It advances only through explicit Settings actions or a final flight report. No payroll deductions or operating expenses are implemented. Contract revenue belongs to the company, never the pilot's personal salary; fuel consumption does not charge money or create a fuel inventory.

## Dispatch and Flight Operations

Dispatch only shows explicitly defined contracts departing from the aircraft's current airport. The original five fictional Kodiak stories remain:

| Contract | Destination | Type | Payload | Approximate distance | Company revenue on delivery |
| --- | --- | --- | --- | --- | --- |
| The cannery’s missing part | Larsen Bay (PALB) | Cargo | 780 lb | 50 NM | $1,450 |
| A classroom worth of possibilities | Old Harbor (PADY) | Cargo | 540 lb | 44 NM | $1,250 |
| Keeping the lights on | Akhiok (PAKH) | Cargo | 960 lb | 74 NM | $2,100 |
| The village gathering | Ouzinkie (4K5) | Passenger charter | 920 lb | 12 NM | $850 |
| Field notes from the island | Port Lions (PORI) | Passenger charter | 840 lb | 24 NM | $1,150 |

Each destination has one explicitly defined fictional return contract to PADQ: cannery records (PALB, $1,000), visiting teachers (PADY, $1,050), tool cases (PAKH, $1,600), gathering guests (4K5, $700), or research samples (PORI, $800). No procedural or impossible origin routes are generated. Airports outside this set show a clear **no contracts** state. Repositioning is not implemented, so a diversion to an unsupported airport can leave the aircraft without further contracts in this release.

1. **Select a contract.** Only one can be active. A unique flight-instance ID distinguishes repeated acceptances of the same contract. Cancellation is free and discards any saved report after confirmation.
2. **Open Flight Operations** from the active contract or Dashboard. Review origin, destination, manifest, proposed revenue, approximate direct distance and operational considerations.
3. **Enter planning estimates if known.** No verified aircraft time or fuel performance data is bundled. The optional planning section accepts the player's estimated minutes and fuel burn. Otherwise these remain unavailable, not invented. Planning estimates remain separate from reported actuals in the logbook and backup.
4. **Enter the post-flight report.** Actual flight time is mandatory for submission, as whole minutes from 1 to 1,440. Optional consumed fuel accepts 0–10,000 pounds with up to two decimal places; blank means unknown, not zero. These are manual-entry sanity bounds, not aircraft operating limits. Enter delivery status, landing outcome, actual arrival airport and optional pilot notes (2,000 characters maximum). Airport codes accept 3–4 letters/numbers; code existence is not checked against a worldwide database.
5. **Save Flight — Finish Later.** Saves a local draft, including blank time if not yet known, without revenue, mission completion, aircraft movement, hour accumulation or clock advancement. Save before leaving the screen or closing the browser. Typing alone does not save report edits. Reopen Flight Operations after refresh to continue.
6. **Submit Flight Report.** Review a separate confirmation screen. Nothing happens until **Confirm & submit report**. A completed delivery must arrive at the contracted airport. Submission records an immutable report snapshot, credits the proposed revenue to company cash once, increments completed missions once, updates aircraft and company flying hours, moves the aircraft to the reported arrival, adds the reported minutes to the current operational clock and clears the active mission/draft. Logbook UTC timestamps describe game time at submission, not real-world takeoff/landing or telemetry.

### Diversions, incomplete deliveries and hard landings

A diversion requires a different arrival airport; an incomplete delivery may be reported at any arrival, including the contracted destination. Both close the active mission and record the flown hours, elapsed game time and actual arrival **without revenue or an increment to successful completed missions**. No later resumption of the same delivery, cargo inventory or partial payment exists yet.

A hard landing is a separate outcome and is preserved even if the delivery was completed. A completed delivery after a hard landing receives the contract revenue. A hard diversion or incomplete delivery does not. Mara acknowledges it and the logbook flags it. Maintenance status remains unchanged: there is no automatic damage, grounding, repair charge or maintenance simulation. Assess the aircraft in MSFS before further flying.

## Dispatcher Mara

Short, local rule-based acknowledgments react to contract type, saved drafts, cancellation, delivery outcome, hard landings and estimates versus reported time/fuel. More than 25% above a positive player estimate triggers a planning-review comment, never a financial penalty or claim about aircraft performance. No comparison is made for unavailable estimates. Outcome and hard-landing messages take priority over performance commentary. Each context has three variants; a persisted six-message ID history avoids recent repetition and falls back to the least recently used variant when all variants have been used. No external AI API is called.

## Persistence, migration and duplicate protection

The original `airtruckers.save.v1` storage key and `version: 1` remain stable. Version 0.1/v0.2 saves normalize missing flight fields without resetting names, cash, aircraft, pilots, reputation, totals or clock. Accepted v0.2 missions receive deterministic migration IDs; past aggregate flights are preserved without fabricating historical logbook entries. New acceptances get unique IDs.

A single local-storage document contains company state, pending report, active flight-instance ID, logbook, dialogue history and save revision. Web Locks serialize writes across tabs; each write checks the loaded snapshot against current storage. A stale tab must refresh rather than overwrite a newer report or credit revenue again. The domain model also rejects already-recorded flight IDs. Final submission stays on screen if saving fails; company state is not updated in memory or paid until storage succeeds. Invalid numeric inputs, incompatible partial saves and duplicate log entries are rejected rather than silently discarded.

Company mutations save automatically; report edits require the explicit draft save or final submission. Export JSON from Dashboard or Settings; saved drafts and complete logbook snapshots are included. Export does not include unsaved form edits. Backups remain browser-local JSON; **import and cloud sync are not implemented**. A different device, browser profile, origin/port, private browsing or cleared site data may not have the save. Export before clearing storage or changing sites. Avoid editing the same company in old application versions: backward loading of newer flight data in v0.1/v0.2 is not supported.

## Acceptance testing

Automated tests cover company defaults and rename persistence, deliberate clock advancement, validation, older-save migration, drafts, revenue, hours, location and clock updates, completed/incomplete/diverted reports, hard landing, duplicate and stale-tab protection, failed-save retry, defined routes and dispatcher variants. Run `npm test` and `npm run build` before review.

Manual checks on desktop and iPad Safari:

1. Create a company, verify the Caravan at PADQ and $25,000, rename it, then refresh. Confirm progress remains.
2. Select a Kodiak contract and open Flight Operations. Submit with blank, negative or malformed time/fuel: it must refuse. Unknown fuel can remain blank.
3. Enter minutes, optional fuel/notes and different planning estimates. Save Flight; cash, hours, location and clock must remain unchanged. Refresh and verify the draft survives.
4. Choose Submit, then Back to edit: no effects. Confirm final submission: verify one company payment, correct destination, exactly reported minutes added, aircraft/company hours and one successful logbook entry. Verify estimates differ from actuals in the logbook.
5. In a second tab opened before final submission, try submitting the same draft or renaming after the first tab submits. It must refuse with a stale-save message. Refresh; no duplicate payment or report should exist.
6. Export and inspect JSON for `pendingReport`, `activeFlightId`, `logbook`, actual/estimated values and revision. An old-save copy with no new flight fields should load without losing progress. Do not test by editing your only saved copy.
7. From the destination, verify only the defined return route appears. Submit a diversion or incomplete delivery: record time/hours/location, clear the mission and pay nothing. Mark a hard landing and verify its log entry without automatic maintenance changes.
8. Divert to an unsupported code such as PANC: verify the no-contracts state. This is a known gameplay dead end until repositioning is implemented.
9. Repeat draft saves: Mara should vary her acknowledgment. Compare different delivery/landing outcomes and above-plan reports without expecting extra penalties.
10. In an isolated test browser, simulate storage quota failure: final submission must not change the stored company or show success. Retry after resolving the failure; pay only once.
11. Check portrait/landscape iPad and phone widths, touch controls, keyboard focus, readable fields, report confirmation and long notes. Browser refresh without explicit game actions must never advance time.

Browser automation during development exercises draft refresh, validation, review/edit/confirmation, company revenue, stale-tab duplicate rejection, backup contents, destination dispatch, unpaid hard diversion and no-contracts handling. Chromium layout checks cover 1366, 1024, 768 and 390px. Chromium touch emulation is not an actual iPad Safari test.

## Preparing free static hosting (no deployment performed)

No credentials or paid backend are needed. After review/approval, use a static host such as Cloudflare Pages or Netlify with Node 22+, install `npm ci`, build `npm run build`, and publish directory `dist`. Use HTTPS for safe saves. For GitHub Pages use the official Pages Actions to upload/deploy `dist`; Vite's relative `base: './'` supports repository subpaths. Navigation is local application state, so no server route fallback is needed. Never deploy `node_modules` or the development server.

## Architecture and limitations

- `src/game.ts`: versioned state, migrations, flight transitions and atomic local-storage adapter.
- `src/reports.ts`: report types and shared input validation.
- `src/missions.ts`: stable contract IDs, explicit origins and route catalog.
- `src/dialogue.ts`: deterministic context selection, variants and recent-history avoidance.
- `src/FlightOperations.tsx`: draft form, confirmation and logbook views.
- `src/Dispatch.tsx`: current-airport contract board and accepted-flight access.
- `src/main.tsx`: workspace shell, company creation, dashboard, fleet, settings and shared save boundary.
- `src/style.css`: responsive interface with system-font fallbacks for optional Google Fonts.
- `src/game.test.ts`, `src/flights.test.ts`: domain, migration and persistence regression tests.

Version 0.3 uses only the first aircraft and owner/pilot. No simulator connection, verified performance calculations, airport database, repositioning, interrupted-delivery resumption, automatic payroll/expenses, aircraft purchases, employee hiring, interactive checklists, approach charts, logbook editing/undo, backup import or cloud saving is implemented. Clearing an accepted mission is a cancellation, not flight reporting; only submit a report when the flying should count.
