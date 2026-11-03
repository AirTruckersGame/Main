# AirTruckers v0.4 — official-source verification

Verified November 2, 2026, approximately 7:40–7:48 p.m. Eastern (2026-11-03T00:40–00:48Z). All source/report/publication timestamps below are UTC. This is a dated observation, not a hardcoded current catalog.

## Actual endpoint results

Using the existing local Vite middleware for the same `api/efb.ts` / `server/handler.ts` implementation intended for Vercel:

| Check | Observed result |
| --- | --- |
| `action=weather&airport=PADQ&kind=metar` | HTTP 200, available, raw `METAR PADQ 022353Z ...`; observation `2026-11-02T23:53:00.000Z` |
| `action=weather&airport=PADQ&kind=taf` | HTTP 200, available, raw `TAF PADQ 022340Z 0300/0324 ...`; issue `2026-11-02T23:40:00.000Z` |
| `action=weather&airport=PALB&kind=taf` | HTTP 200, missing; browser displayed exactly **No Report**. Availability may change. |
| Controlled PALB TAF HTTP 503 | Browser displayed exactly **Data Unavailable**. This was explicit test fault injection, not a claimed live NOAA outage. |
| `action=charts&airport=PADQ` | HTTP 200, current cycle 2611, 6 supported charts |
| `action=pdf&airport=PADQ&url=...01238IYLY26.PDF` | HTTP 200, `application/pdf`, 429,182 bytes; actual PDF rendered in PDF.js |

No nearby airport was substituted. Displayed raw report text and UTC times were checked in the browser. Weather/chart fetching and approach pinning left company cash at $25,000, the aircraft at PADQ, and operational time unchanged in an isolated test company.

## FAA discovery and actual PADQ charts

Official search page: https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/search/

This page explicitly linked the current index:
https://aeronav.faa.gov/d-tpp/2611/xml_data/d-tpp_Metafile.xml

The 16,261,176-byte XML document declared:

- Cycle: **2611**
- Effective from: **2026-10-29T09:01:00.000Z**
- Effective to (exclusive): **2026-11-26T09:01:00.000Z**
- Airport: `KODIAK`, `apt_ident="ADQ"`, `icao_ident="PADQ"`

Supported chart records actually listed in that index:

| Type | Exact FAA title | Official PDF |
| --- | --- | --- |
| IAP | ILS Y OR LOC Y RWY 26 | https://aeronav.faa.gov/d-tpp/2611/01238IYLY26.PDF |
| IAP | RNAV (GPS) RWY 26 | https://aeronav.faa.gov/d-tpp/2611/01238R26.PDF |
| IAP | VOR RWY 26 | https://aeronav.faa.gov/d-tpp/2611/01238V26.PDF |
| APD | AIRPORT DIAGRAM | https://aeronav.faa.gov/d-tpp/2611/01238AD.PDF |
| ODP | KODIAK SEVEN (OBSTACLE) | https://aeronav.faa.gov/d-tpp/2611/01238KODIAK.PDF |
| ODP | KODIAK SEVEN (OBSTACLE), CONT.1 | https://aeronav.faa.gov/d-tpp/2611/01238KODIAK_C.PDF |

The original product page exposed ZIP publication dates rather than cycle-directory links. Discovery now uses the explicit XML links on the official search page; unrelated volume-search cycle links are ignored. FAA's XML host returned 406 with the previous mixed Accept header and with `application/xml`; `Accept: */*` returned 200 with TLS verification preserved. Actual ODP records are now supported alongside DP; no departure is inferred or fabricated.

## Genuine PDF verification

Retrieved **ILS Y OR LOC Y RWY 26** from the app proxy and independently from its official FAA URL. Both produced this SHA-256:

`54889544f2f12fcf23ddafde0c11ef337290733ac8b0f9594f9f1f4353767dab`

The browser did not use a PDF fixture or intercepted success response for this verification. PDF.js fetched the real bytes through `/api/efb`, loaded its same-origin bundled worker and rendered opaque, non-white chart content. Chromium touch emulation checks covered:

- Zoom buttons and fit-to-width.
- Two-touch pinch via browser input events.
- Drag panning with measured scroll movement.
- In-app full-screen view and exit.
- Pinning the actual approach, reloading and one-tap return from Flight Operations.
- Changing the pin to the actual RNAV (GPS) RWY 26 plate.
- No horizontal page overflow at 1366, 1024, 768 and 390px.
- No page JavaScript errors; all data/PDF requests stayed on the app origin.

This is **Chromium**, not physical iPad Safari. External FAA links remain available if PDF rendering fails. Cycle 2611 will expire; future lookups must discover the current metadata rather than rely on this historical list.

## Tests and repeatable checks

`npm test` includes the earlier synthetic boundary fixtures plus recorded official PADQ weather, the official search-page XML-link excerpt and the PADQ airport excerpt from the national index. Recorded data is historical regression input only, never an application fallback. XML dates are tested at fixed times, including the expiration boundary.

Start the application with `npm run dev`, then run `npm run verify:live`. The opt-in script uses the actual endpoint, validates raw PADQ reports/times, requires a current FAA catalog/diagram/approach, retrieves a listed PDF and prints its hash. It writes no game state. Run it against a future approved preview using `AIRTRUCKERS_LIVE_BASE_URL=https://YOUR_PREVIEW_ORIGIN npm run verify:live`.

## What remains unverified

No push, merge or deployment was performed. The same-origin proxy architecture removes the need for browser CORS permission from NOAA or FAA, but an actual Vercel preview is still required to confirm:

1. Node-function bundling/imports, runtime/version, the 60-second duration and national-index memory/CPU use under cold starts.
2. FAA/AWC acceptance of requests from Vercel egress IPs, rate limits and cache behavior across serverless instances.
3. `/api/efb` routing, binary PDF delivery, worker `.mjs` asset MIME type, and any deployment-specific CSP/security headers.
4. Preview protection behavior and the browser's same-origin requests on HTTPS.
5. Physical iPad Safari pinch/pan/full-screen, memory usage, readability and saved-pin persistence.

Local live success does not establish those deployment/device outcomes. No external network blocker remains in this environment at this verification time.
