# AirTruckers · Alaska Operations · Version 0.5D

A browser-based aviation career and company management companion for Microsoft Flight Simulator 2020 on Xbox. Flights are flown in MSFS and reported manually here. No simulator telemetry, external AI service, backend or account is required.

## Run and validate

Use Node.js 24.x and npm. The package engine pins the Vercel function to the same tested Node major.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Vite prints the local development address and includes the EFB API middleware. `npm run preview` serves only the production static bundle; use Vercel development/deployment for production-function testing, or Vite development for local live EFB requests. HTTPS is recommended with current Safari, Chrome or Firefox. Safari supports Web Locks from version 15.4 in secure contexts; older Safari and plain HTTP LAN addresses may not expose it. When Web Locks is missing or rejects access before the save starts, the app falls back automatically to IndexedDB transaction coordination. Company creation, drafts, final reports and other saves remain usable without Web Locks. Flight IDs use secure `crypto.getRandomValues`, not the secure-context-only `randomUUID` API. For actual iPad acceptance testing, use an HTTPS-hosted test copy when possible. Native controls, 16px report inputs, explicit labels and responsive single-column forms support touch and Safari; real iPad acceptance testing is still required.

## Existing company functionality

Create a company at Kodiak (PADQ), with $25,000 and one fully owned Cessna 208B Grand Caravan EX. One owner/pilot has an informational salary of $65,000 annually ($2,500 per biweekly period, 26 periods/year). Renaming preserves all progress. Dashboard, Aircraft, Company Settings, Flight Planning / EFB, Flight Operations and Flight Logbook remain available; Finances is a future-feature placeholder.

Reputation starts at neutral 50/100; this release does not alter it. The operational clock starts at June 1, 2026 at 08:00 UTC and does not follow real time. It advances only through explicit Settings actions or a final flight report. No payroll deductions or operating expenses are implemented. Contract revenue belongs to the company, never the pilot's personal salary; fuel consumption does not charge money or create a fuel inventory.

## Dispatch and Flight Operations

Dispatch now uses a persistent seeded generator instead of repeating the fixed v0.2–v0.4 assignments. There are 21 curated story templates, 24 fictional customers and seven mission categories: general cargo, commercial resupply, medical logistics, government/infrastructure, priority freight, community delivery and passenger charter. Mission text, customers, cargo quantities or passenger groups, route choices and proposed payouts vary. No AI service is called.

### Curated airports and routes

New assignments use **PADQ Kodiak, PALB Larsen Bay, PAKH Akhiok, PAHO Homer and PAEN Kenai**, verified against FAA-sourced AWC airport records. Curated bidirectional pairs are Kodiak–Larsen Bay, Kodiak–Akhiok, Kodiak–Homer, Kodiak–Kenai and Homer–Kenai. Distances are rounded great-circle estimates from those coordinates, not filed routes or performance/range guarantees. No airport services, runway capability, weather coverage or approach procedure is inferred from a route's presence. See [airport provenance and legacy limitations](docs/dynamic-dispatch.md).

An unsupported airport shows no generated contracts. The old v0.4 PADY/Old Harbor pairing was incorrect: the official PADY record is Kongiganak. Legacy assignments, locations and history retain their original codes/payouts rather than being silently relocated or rerouted; a specific warning identifies that old pairing. Legacy destinations outside the verified new route set have no new generated board. Repositioning and user-approved legacy-location repair are not implemented.

### Generation, refresh and repetition rules

- A new company stores a random seed and a monotonic assignment counter. The generator is deterministic from that seed, airport, operational slot and counter; explicit seeds are supported in the domain API for tests/replays. Generated instance IDs include the full seed namespace and serial. Completed or cancelled instances are never reoffered.
- A saved board holds up to four distinct offers, preferring different supported destinations before repeating a route. Opening Dispatch, refreshing Safari, renaming, exporting, weather/chart requests and real-world elapsed time do **not** regenerate it. Older saves receive a deterministic initial board during migration, which is preserved on the next normal save.
- Offers expire at UTC-aligned **operational** 00:00/06:00/12:00/18:00 boundaries. Deliberately advancing game time into another slot replaces the current airport's offers. Jumping several slots generates only the final slot, not a backlog.
- A submitted flight adds/refills arrival-airport opportunities. Unexpired nonconflicting cards retain their IDs and contents; new cards fill remaining space. A deterministic 40% gate can withhold **new** jobs back to the previous origin for that batch. Other routes may still have offers. A leaf airport can have an empty board until a later operational slot; return work is possible, not automatic.
- The last six **reported** assignments (including diversions/incomplete deliveries) suppress matching titles, storyline IDs, customers and grouped similar payload families on **all saved boards**. Related hardware/bearings, paper supplies, textiles, clinic supplies, fragile instruments, education loads and passenger groups share families. This survives round trips and reloads; it is a six-assignment window, not a promise of never seeing a theme again. Categories can recur with different loads.
- Accepting removes an offered instance and stores a detached full contract snapshot. Its route, story, manifest and actual payout remain fixed even if game time passes its former offer expiry. Cancellation is free, discards the draft/pin and retires that instance; it does not instantly reroll the board. Finish or cancel before taking another assignment.

### Conservative loading and revenue assumptions

These are **game planning assumptions, not certified Caravan limits or verified aircraft performance**: a 2,800 lb useful-load planning budget reserves 1,400 lb assumed fuel, 220 lb owner/pilot and 180 lb margin, leaving at most 1,000 lb for the job. Generated cargo weighs 120–950 lb. Charters carry 1–4 passengers at an assumed 220 lb each plus 25 lb of personal baggage each (245–980 lb total). The four-passenger cap is a conservative game cap, not a claim about installed seats. No extra technician tools are hidden outside the manifest.

Actual MSFS aircraft configuration, fuel needed/reserves, weights, centre of gravity, density altitude, terrain, runway condition and performance must be checked independently. The app neither loads the simulator nor certifies takeoff/landing feasibility or fuel endurance. All medical cargo is routine, nonhazardous logistics; no patient transport or cold-chain capability is promised. Priority jobs have a price premium, not an enforced deadline or safety exemption.

Proposed revenue is rounded to $25: `(350 + distanceNM × 7 + payloadLb × 0.45) × categoryMultiplier`, using 1.00 cargo/community, 1.05 commercial, 1.10 infrastructure, 1.15 medical, 1.20 charter or 1.25 priority. Validation bounds generated payouts to $350–$3,000. This is fictional game pricing, not real charter pricing. Only the **accepted stored payout** is credited once after a reported completed delivery; no salary deduction, fuel charge or operating expense is added. Generation itself changes no cash or operational time.

1. **Select a contract.** Only one can be active. Each assignment has a unique generated ID and a separate flight-instance nonce; old fixed assignments can survive only as migrated active saves, not as selectable new offers. Cancellation is free and discards any saved report after confirmation.
2. **Plan flight / EFB** from the accepted contract, review weather/charts, then return to Flight Operations. A permanent **Flight Bag** button in Flight Operations and a one-tap **Pinned Approach** button keep the mission workflow together. Flight report edits remain mounted when visiting the EFB, but still require explicit saving to survive refresh. **Open Flight Operations** from the active contract or Dashboard. Review origin, destination, manifest, proposed revenue, approximate direct distance and operational considerations.
3. **Enter planning estimates if known.** No verified aircraft time or fuel performance data is bundled. The optional planning section accepts the player's estimated minutes and fuel burn. Otherwise these remain unavailable, not invented. Planning estimates remain separate from reported actuals in the logbook and backup.
4. **Enter the post-flight report.** Actual flight time is mandatory for submission, as whole minutes from 1 to 1,440. Optional consumed fuel accepts 0–10,000 pounds with up to two decimal places; blank means unknown, not zero. These are manual-entry sanity bounds, not aircraft operating limits. Enter delivery status, landing outcome, actual arrival airport and optional pilot notes (2,000 characters maximum). Airport codes accept 3–4 letters/numbers; code existence is not checked against a worldwide database.
5. **Save Flight — Finish Later.** Saves a local draft, including blank time if not yet known, without revenue, mission completion, aircraft movement, hour accumulation or clock advancement. Save before leaving the screen or closing the browser. Typing alone does not save report edits. Reopen Flight Operations after refresh to continue.
6. **Submit Flight Report.** Review a separate confirmation screen. Nothing happens until **Confirm & submit report**. A completed delivery must arrive at the contracted airport. Submission records an immutable report snapshot, credits the proposed revenue to company cash once, increments completed missions once, updates aircraft and company flying hours, moves the aircraft to the reported arrival, adds the reported minutes to the current operational clock and clears the active mission/draft. Logbook UTC timestamps describe game time at submission, not real-world takeoff/landing or telemetry.

### Diversions, incomplete deliveries and hard landings

A diversion requires a different arrival airport; an incomplete delivery may be reported at any arrival, including the contracted destination. Both close the active mission and record the flown hours, elapsed game time and actual arrival **without revenue or an increment to successful completed missions**. No later resumption of the same delivery, cargo inventory or partial payment exists yet.

A hard landing is a separate outcome and is preserved even if the delivery was completed. A completed delivery after a hard landing receives the contract revenue. A hard diversion or incomplete delivery does not. Mara acknowledges it and the logbook flags it. Maintenance status remains unchanged: there is no automatic damage, grounding, repair charge or maintenance simulation. Assess the aircraft in MSFS before further flying.

## Dispatcher Mara

Short, local rule-based acknowledgments react to contract type, saved drafts, cancellation, delivery outcome, hard landings and estimates versus reported time/fuel. More than 25% above a positive player estimate triggers a planning-review comment, never a financial penalty or claim about aircraft performance. No comparison is made for unavailable estimates. Outcome and hard-landing messages take priority over performance commentary. Each context has three variants; a persisted six-message ID history avoids recent repetition and falls back to the least recently used variant when all variants have been used. Category-specific acknowledgments now cover all seven generated mission categories. `src/dispatcherContext.ts` exposes a detached, deeply frozen, read-only snapshot of company/aircraft state, active assignment, available work, recent story/customer/payload context and the last report for future v0.5B integration. It contains no command/mutation capability. No external AI API is called.

## Persistence, migration and duplicate protection

The original `airtruckers.save.v1` storage key and `version: 1` remain stable. Version 0.1/v0.2 saves normalize missing flight fields without resetting names, cash, aircraft, pilots, reputation, totals or clock. Accepted v0.2 missions receive deterministic migration IDs; past aggregate flights are preserved without fabricating historical logbook entries. New acceptances get unique IDs. Version 0.5A adds persisted `dispatch` and `activeContract` fields. Legacy active IDs resolve to unchanged fixed snapshots only during migration. New logbook entries include the full accepted snapshot; old entries do not need to be rewritten. Partial/corrupt dispatch fields and repeated generated assignment IDs are rejected without overwriting stored progress.

A single local-storage document contains company state, pending report, active flight-instance ID, logbook, dialogue history and save revision. An IndexedDB read/write transaction coordinates every save across tabs, including clients that additionally use Web Locks. The coordination database contains no game data; the single local-storage document remains authoritative. A transaction serializes the synchronous snapshot check and local-storage write; local-storage leases or check-then-write alone are not used as locks. Each write checks the loaded snapshot against current storage. A stale tab must refresh rather than overwrite a newer report or credit revenue again. Missing/unsupported Web Locks uses the same IndexedDB gate, so mixed clients share protection. Web Locks rejection falls back only if the protected callback has not started; failed writes are never automatically retried. A successful local-storage write is acknowledged immediately, even if the coordination transaction later aborts, because retrying an already-applied payment would be misleading. The domain model also rejects already-recorded flight IDs. Final submission stays on screen if saving fails; company state is not updated in memory or paid until storage succeeds. Invalid numeric inputs, incompatible partial saves and duplicate log entries are rejected rather than silently discarded.

If IndexedDB is also unavailable, blocked, denied or interrupted before the write, saving fails closed with an error; existing company data remains readable/exportable and report inputs stay on screen. Enable site storage or close blocking tabs and retry. There is no unsafe uncoordinated-write fallback. A storage quota failure likewise preserves the previous save. All tabs should reload the current application before editing; older application versions cannot participate in this coordination protocol.

Company mutations save automatically; report edits require the explicit draft save or final submission. Export JSON from Dashboard or Settings; saved drafts and complete logbook snapshots are included. Export does not include unsaved form edits. Backups remain browser-local JSON; **import and cloud sync are not implemented**. A different device, browser profile, origin/port, private browsing or cleared site data may not have the save. Export before clearing storage or changing sites. Avoid editing the same company in old application versions: backward loading of newer flight data in v0.1/v0.2 is not supported.

## Acceptance testing

Automated tests cover company defaults and rename persistence, deliberate clock advancement, validation, older-save migration, drafts, revenue, hours, location and clock updates, completed/incomplete/diverted reports, hard landing, duplicate and stale-tab protection, failed-save retry, fallback/mixed-client coordination, secure IDs without randomUUID, defined routes and dispatcher variants. Run `npm test` and `npm run build` before review.

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
10. In an isolated test browser, hide `navigator.locks` (and `crypto.randomUUID`) before loading. Create a company, save/reload a draft, submit, and repeat the stale-tab check: the full workflow must still work. Repeat with one tab exposing Web Locks and another hiding it.
11. In an isolated test browser, simulate storage quota failure: final submission must not change the stored company or show success. Retry after resolving the failure; pay only once.
12. Check portrait/landscape iPad and phone widths, touch controls, keyboard focus, readable fields, report confirmation and long notes. Browser refresh without explicit game actions must never advance time.

Browser automation during development exercises draft refresh, validation, review/edit/confirmation, company revenue, stale-tab duplicate rejection, backup contents, destination dispatch, unpaid hard diversion and no-contracts handling. Chromium layout checks cover 1366, 1024, 768 and 390px. Chromium touch emulation is not an actual iPad Safari test.

## Flight Planning & Electronic Flight Bag

### Live integration status

Live verification succeeded on November 2, 2026 (Eastern; requests at 2026-11-03T00:40–00:47Z). The same Vercel-compatible endpoint used by Vite returned actual PADQ METAR/TAF reports, current FAA XML metadata and a genuine PADQ approach PDF, rendered by the integrated PDF.js viewer in Chromium. See [the verification record](docs/live-verification.md) for exact sources, chart titles, timestamps, hashes and outstanding checks.

Required outbound hosts are `aviationweather.gov`, `www.faa.gov`, and `aeronav.faa.gov`. Network access is now working in this environment. No static catalog is substituted if an official request fails. Actual Vercel egress/function packaging and physical iPad Safari behavior remain preview/device acceptance checks; no deployment was performed.

### Official sources and proxy

- AWC API documentation: https://aviationweather.gov/data/api/
- Server request paths: `https://aviationweather.gov/api/data/metar?ids=PADQ&format=json` and the equivalent `taf` resource. The JSON formats, raw text and UTC observation/issue field mappings were confirmed live for PADQ.
- FAA d-TPP publication page: https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/
- FAA IFR enroute collection: https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/ifr/
- FAA VFR sectional collection: https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/vfr/

The browser requests only the same-origin `/api/efb` function, avoiding AWC's browser CORS restriction. `api/efb.ts` exposes a Vercel Node function; `server/handler.ts` is also mounted in Vite for local development. `server/providerFetch.ts` honors inherited HTTP/HTTPS proxy settings with normal TLS verification. No private tokens are embedded in the app.

`action=weather&airport=PADQ&kind=metar` (or `taf`) requests each report independently for departure and destination. Exact 3–4 character IDs are normalized to uppercase; no ICAO prefix or nearby station is guessed. A provider response for a different station is a failure, not a substitution. An empty list or HTTP 204 displays exactly **No Report**. HTTP failures, timeouts, invalid responses and rate limiting display **Data Unavailable**. Raw reports, provider observation/issue UTC timestamps when parseable, retrieval timestamps and only finite provider-decoded temperature/dew point/wind fields are displayed. TAF forecasts remain raw; unavailable values are not invented. Real-world weather may differ from Xbox MSFS weather.

Provider requests use 8-second timeouts, bounded response sizes, a 60-second weather cache, coalescing of identical in-flight requests and short error cooldowns. Provider 429 Retry-After seconds are respected up to five minutes. Manual refresh does not bypass the provider cooldown. A 60-requests/minute client guard and bounded caches are per server instance, not globally distributed rate limiting; production traffic may warrant platform-level controls. API inputs reject duplicate/unexpected parameters and invalid IDs/URLs. There is no arbitrary-host proxy and redirects are refused.

### FAA catalog/update strategy

`action=charts&airport=PADQ` reads the official [FAA terminal-procedures search page](https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/search/), discovers up to three explicit d-TPP Metafile XML links, then retrieves the referenced indexes:

`https://aeronav.faa.gov/d-tpp/{cycle}/xml_data/d-tpp_Metafile.xml`

This URL convention and XML schema were verified live for cycle 2611. The product landing page lists date-coded ZIP downloads rather than cycle links; the search page provides the authoritative XML link. No cycle is inferred from ZIP dates, unrelated page links or the calendar. The XML host returned HTTP 406 for the previous mixed Accept header and even explicit application/xml; requests now use the verified `Accept: */*`. There is no hardcoded current cycle. The parser requires a matching `digital_tpp` cycle and explicit `from_edate`/`to_edate` UTC interval, matches `icao_ident` or `apt_ident` exactly, and uses only supplied `chart_name`, `chart_code` (IAP/APD/DP/ODP/STAR) and a safe `pdf_name`. PDF URLs are assembled only under that index's official FAA cycle directory. Invalid filenames, entities/DOCTYPE declarations, missing dates or unknown formats fail closed. No procedure type or airport availability is assumed. Unsupported FAA format changes require updating the adapter and tests.

National publication documents are cached up to one hour, airport catalogs five minutes; effective intervals are rechecked even on cache hits. An expired/future cycle is explicitly marked **not current**, never silently relabeled. The browser updates date labels at publication boundaries and when returning from the background; publication time never advances the operational game clock. A valid empty index match displays no published terminal charts/approaches; index retrieval failures display Data Unavailable instead.

Only an IAP from the current, returned mission-airport catalog can be pinned. The saved pin contains the flight-instance ID, airport, title, PDF URL, source XML URL, cycle and publication interval. Version 0.1–0.3 saves default to an empty pin without changing other data. Pins persist in local saves/JSON backups and clear with mission cancellation/submission. Changing approaches replaces the pin. A previously pinned expired chart remains visible with an outdated warning and cannot be repinned as current.

### Integrated PDF viewer

PDF.js 4's legacy build and a bundled same-origin worker render into a canvas, with zoom buttons, pinch gestures, drag panning, page selection, fit-to-width and an in-app CSS full-screen view (including iPad Safari without the element Fullscreen API). Canvas rendering is capped at 12 megapixels and device density 2 to limit iPad memory use. Zoom may be resolution-limited on very large pages. Loading/render errors retain the official FAA open/download link. The PDF proxy requires membership in the airport's validated catalog, a safe FAA URL and a `%PDF-` signature; an old pin missing from the discovered catalog may need the official external fallback.

IFR enroute and VFR sectional collections are external official links only; integrated enroute browsing is not implemented. Current FAA procedures can differ from the simulator navigation database. This is a simulation companion, not a certified navigation product.

### EFB validation and acceptance

Run `npm test` and `npm run build`. Added tests cover exact station handling, No Report vs Data Unavailable, partial provider failure, retry caching, invalid parameters/links, metadata-only chart selection, cycle/date validation, pin persistence/migration, publication expiry and viewer fallback. Both explicitly synthetic edge-case fixtures and recorded official AWC/FAA regression fixtures are included. Recorded responses are historical test data, never a production catalog or weather fallback; their publication times are fixed in tests. No fixture catalog is used as application data.

Browser checks with synthetic network/PDF fixtures verify actual opaque PDF canvas pixels, zoom, touch pinch, panning controls, fit/full-screen, pin persistence, report edits retained across EFB navigation, errors/fallback and 1366/1024/768/390px layouts. Existing post-flight reporting browser checks were also rerun. Separately, live PADQ weather and a genuine cycle-2611 approach were verified through the endpoint and integrated viewer, including actual opaque PDF pixels, pinch zoom, drag panning and pin/change/reload. API failure display was tested through controlled browser fault injection, not by claiming a live AWC outage. **Actual portrait/landscape iPad Safari testing must be performed by the user.**

Repeat the opt-in, read-only live check against a running server:

```sh
npm run dev
# In a second terminal (or set AIRTRUCKERS_LIVE_BASE_URL to an approved preview origin):
npm run verify:live
```

The check requests actual PADQ METAR/TAF reports, records whether PALB currently has a TAF, requires current FAA PADQ approaches/diagram, downloads an index-listed PDF and outputs its SHA-256. It performs no company mutations. Live checks are intentionally separate from deterministic `npm test`: source outages, rate limits, expired cycles or a temporarily absent PADQ report will fail the live check rather than fabricate a passing result.

Before release:

1. On an approved Vercel preview, run `AIRTRUCKERS_LIVE_BASE_URL=https://YOUR_PREVIEW_ORIGIN npm run verify:live`. Confirm server egress to both providers, content negotiation, XML parse time/memory, response sizes, function duration and `/api/efb` routing. Preview protection may require opening access for this read-only verifier; do not put access credentials in the script.
2. Open Flight Planning on the preview. Check browser requests remain same-origin for weather, XML/catalog and PDF; verify the bundled PDF worker loads with the correct MIME type and no CORS/CSP errors. An external official open/download link is navigation, not a cross-origin JavaScript fetch.
3. On actual portrait/landscape iPad Safari, open a current genuine approach, use pinch/drag/fit/full-screen, pin it, refresh, return via Pinned Approach and change it. Confirm game finances, location and operational time stay unchanged.
4. Check unavailable reports, a stale pin, missing procedures and controlled proxy failures. Do not claim availability or currency from a failed request. The recorded cycle-2611 chart list is evidence of that verification only, not a promise of future chart availability.

## Vercel deployment preparation (nothing deployed)

Full EFB functionality now requires a server function; a static-only GitHub Pages upload cannot provide weather/chart/PDF proxies. `vercel.json` selects Vite, builds with `npm run build`, publishes `dist`, and configures `api/efb.ts` with a 60-second maximum duration. Use Node 24.x (pinned in `package.json` and the lockfile), install via `npm ci`, and retain `api/`, `server/` and `src/efbData.ts` in the repository so Vercel can build the function. No SPA catch-all rewrite should capture `/api/efb`.

Vite development includes the API middleware. `npm run preview` is static-only; use Vercel local development or a separately tested server for production API validation. Production build, deterministic tests, native-Node function cold-start tests and local live checks through the official Vercel builder output passed. A previously reproduced ESM import failure is corrected; see [the packaging diagnosis](docs/vercel-function-diagnosis.md). Actual redeployed preview behavior, provider permission for Vercel egress IPs and deployment-specific CSP/worker behavior still need verification. HTTPS is recommended; existing IndexedDB save coordination supports browsers without Web Locks. Do not deploy until the outstanding Vercel-preview and actual iPad checks are completed and release approval is given.

### Server packaging checks

`npm run build` first runs `npm run check:server`, using `api/tsconfig.json` with NodeNext module resolution. Server-side relative imports must name the emitted `.js` files even in TypeScript source; Node ESM does not resolve extensionless imports like Vite does. Do not switch the server graph back to Bundler resolution to silence these errors.

`npm test` includes `src/serverPackaging.test.ts`: it emits the API dependency graph into an isolated ESM directory, cold-loads it with a native Node child process (no Vite/TS loader), and invokes weather, catalog, binary PDF, validation and failure paths with provider fixtures. The test requires permission to launch a local Node process. The official Vercel Node builder was also checked independently without deploying; before correction its output failed with ERR_MODULE_NOT_FOUND, and after correction its artifact cold-loaded and passed live PADQ provider checks.

## Architecture and limitations

- `src/game.ts`: versioned state, migrations, flight transitions, approach pins and atomic local-storage adapter.
- `src/efbData.ts`: shared EFB contracts and strict FAA link/airport validation.
- `server/providers.ts`, `server/service.ts`: weather/FAA metadata adapters, validated PDF proxy, cache/limits/timeouts.
- `api/efb.ts`, `server/handler.ts`: Vercel/Vite server entry points; `api/tsconfig.json` checks the Node ESM module graph.
- `src/FlightPlanning.tsx`, `src/ChartViewer.tsx`: weather/catalog UI and PDF.js rendering.
- `src/usePublicationClock.ts`: real-world publication labels, separate from operational time.
- `src/storageGate.ts`: shared IndexedDB transaction gate, optional Web Locks and safe fallback.
- `src/reports.ts`: report types and shared input validation.
- `src/missions.ts`: immutable legacy contract definitions for migration and shared assignment types.
- `src/generator.ts`: curated routes/templates, deterministic generation, loading validation, board refresh and global repetition memory.
- `src/dispatcherContext.ts`: read-only future conversation context.
- `src/dialogue.ts`: deterministic context selection, variants and recent-history avoidance.
- `src/FlightOperations.tsx`: draft form, confirmation and logbook views.
- `src/Dispatch.tsx`: current-airport contract board and accepted-flight access.
- `src/main.tsx`: workspace shell, company creation, dashboard, fleet, settings and shared save boundary.
- `src/style.css`: responsive interface with system-font fallbacks for optional Google Fonts.
- `src/game.test.ts`, `src/flights.test.ts`, `src/storageGate.test.ts`: existing domain/migration/persistence tests.
- `src/efb.test.ts`, `src/ChartViewer.test.tsx`, `tests/fixtures/`: synthetic plus recorded-official EFB provider, pin, expiry and viewer tests; `scripts/verify-live.mjs` is the opt-in live endpoint check.

Version 0.5A uses only the first aircraft and owner/pilot. No simulator connection, verified performance calculations, airport database, repositioning, interrupted-delivery resumption, automatic payroll/expenses, aircraft purchases, employee hiring, interactive checklists, integrated enroute browsing, logbook editing/undo, backup import or cloud saving is implemented. Clearing an accepted mission is a cancellation, not flight reporting; only submit a report when the flying should count.

## Version 0.5A validation

`npm test` retains financial, draft, old-save, EFB and native server-packaging checks and adds seeded generation, multi-slot uniqueness, story/customer/manifest variety, official airport-coordinate fixtures, loading/route/payout validation, a 25-leg anti-repetition career, round-trip behavior, return-job withholding, stable accepted snapshots/pins, concurrent payment protection and read-only dispatcher context tests. Historical fixtures are not production airport/weather catalogs.

Manual acceptance: create a company, record the four offers, reload and revisit Dispatch; they must match. Accept one, save a report draft and check no balance/location change. Visit Flight Bag, pin an actual available approach, return and submit; revenue must equal the accepted payout. Reload at the arrival airport and inspect new offers. Advance game time across a six-hour slot without charges. Fly back when a return is offered and confirm recently reported themes/customers/payload families are absent. Export JSON and verify dispatch seed/counter/boards, active snapshot, draft, pin and logbook. Actual iPad Safari device and a future approved preview remain acceptance checks; no deployment is part of this task.

## Version 0.5C — visual mission polish

Dispatch cards now use compact, accessible Lucide symbols for freight, tools, medical/utility supplies, passengers, records, seafood/cannery and education loads. Each route has small exact-airport departure/arrival METAR indicators. Accepted assignments receive a destination hero in Dispatch and Flight Operations with airport code/name, route, mission symbol, stored payout/payload, weather summaries and the original actions.

The built-in SVG scene library provides representative Kodiak, Larsen Bay, Akhiok, Homer and Kenai illustrations plus a generic Alaska fallback. These are clearly labeled artistic landscapes, **not actual airport imagery, airport diagrams or current weather**. There are no live image requests/APIs, and dispatch list cards have no large scenery.

Weather indicators use the existing same-origin METAR endpoint; the FAA/NOAA server adapters and EFB remain unchanged. Display-only parsing recognizes standard cloud, precipitation, obscuration, visibility, wind/gust and low-ceiling tokens before METAR remarks. Labels describe reported conditions rather than certifying VFR/IFR or recommending a flight. Multiple phenomena are compacted to a primary symbol, with extra wind/caution indicators where applicable; consult raw reports in Flight Bag. Wind emphasis uses 20 kt sustained / 25 kt gust display thresholds, not aircraft operating limits. Missing reports remain **No Report**; API/network/malformed or wrong-station responses remain **Data Unavailable**, without nearby substitutions. Reports older than two hours or implausibly future-dated show an age caution; missing observation times stay neutral.

Requests are deduplicated/cached per airport in memory (60 seconds, 15 seconds for errors), with five-minute refresh while mounted and minute-by-minute age checks. Manual weather refresh changes only this display cache. Server caching/rate limits still apply. No weather result is written into company saves; refreshing it cannot regenerate assignments, advance operational time, credit revenue or alter accepted state.

Presentation tests cover semantic icon mapping, all weather states, age/error handling, request deduplication, representative/fallback scenery, accessible labels, and absence of storage/game mutations. Chromium checks covered 1366px desktop, 1024px landscape tablet, 768px portrait tablet and 390px phone layouts, plus draft persistence and correct stored-payout submission. Physical iPad Safari and a future approved preview remain device/deployment checks. The v0.5A generator, loading assumptions, finances, migrations, pinning and report transitions are unchanged.

## Version 0.5D — Interactive Flight Checklists

Open **Flight Checklists** from the workspace navigation or Flight Operations, with or without an accepted mission. Select **Without Cargo Pod**, **Cargo Pod Installed**, **Cargomaster**, or **Amphibian** to match your Black Square simulator aircraft. This is a checklist configuration only; it does not replace the company's Grand Caravan EX, change mission loading assumptions, or apply the Black Square performance tables to the game model.

Source: the user-supplied *Black Square Caravan Professional User Guide (2026)*, normal checklists pp. 120–122; governor explanation p. 61; configuration names pp. 12–13. `src/checklistData.ts` retains source order, repeated checks, POH references, and page provenance. The original PDF is not bundled. All four configurations share the normal checklist, with the manual's starred items included only for the Amphibian. Neither additional configuration-specific procedures nor emergency checklists have been invented.

The 15 procedures cover before starting, battery start, external-power start, taxi, before-takeoff runup, takeoff, maximum-performance climb, enroute climb, cruise, descent, before landing, landing, balked landing, after landing, and shutdown/securing. Battery/external-power starts and normal/balked landings are alternatives; completing every procedure is not a requirement to report a flight. A checked procedure means its visible items were manually acknowledged, not that an aircraft system passed a test.

Tap the large checkbox rows to check/uncheck items. Procedure navigation shows completion counts. Optional **Procedure information** pop-ups explain the overspeed governor test (1800 RPM, press/hold, 1750 ±60 RPM check, power idle), start sequence, standby-alternator check, autopilot check, amphibious items and POH references. Pop-ups support keyboard focus, Escape and a large close button. Browser zoom remains enabled. Rows are at least 64px high; buttons and selectors are at least 48px high.

Every configuration, procedure selection, and check/uncheck saves through the existing coordinated save repository. Progress survives navigation and refresh and is included in JSON exports. Older saves receive empty checklist progress without changing their other fields. Other configurations retain their own progress. **Reset this procedure** or **Reset configuration for new flight** asks for confirmation. There is no automatic reset on acceptance, cancellation or submission: reset deliberately before a new flight. Completion does not pay revenue, change location/hours/time, alter drafts, pin/unpin charts or modify mission generation. Report saving/submission continues to work independently.

Testing: run `npm test` and `npm run build`. Checklist tests verify source structure, source-critical governor values, amphibian filtering, separate configuration progress, confirmed resets, refresh/JSON persistence, older-save migration, invalid data rejection, storage failures, information accessibility and unchanged payment/duplicate protection. For manual checks, use desktop, tablet and phone widths; switch configurations, check items, refresh, export JSON, open/close governor help by touch and keyboard, reset/cancel reset, and verify company balance/location/time and pending flight reports are unchanged. Validate on physical iPad Safari before release; Chromium emulation cannot certify Safari behavior or a real cockpit procedure. These are manual simulator checklists, with no telemetry, automatic progression, voice control or emergency procedures in this version.
