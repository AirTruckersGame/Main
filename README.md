# AirTruckers · Alaska Operations

A browser-based aviation career and company management companion for Microsoft Flight Simulator 2020 on Xbox. Version 0.1 provides a local, single-player foundation; it does not connect to or control MSFS.

## Run locally

Use Node.js 22 or newer (validated with Node 24) and npm.

```sh
npm ci
npm run dev
```

Open the address Vite prints. For an iPad on your home network, open your development computer's LAN address on port 5173 in Safari; allow the port through your computer's firewall if needed. For reliable testing, use the deployed HTTPS site below.

```sh
npm test       # game defaults, clock, persistence and invalid-save handling
npm run build # strict TypeScript check and production bundle
npm run preview # locally serve the production build
```

## Version 0.1

- Create a named company at Kodiak (PADQ), with $25,000 and one fully owned Cessna 208B Grand Caravan EX.
- Dashboard, aircraft details and company settings; other navigation destinations are explicitly marked as future features.
- One owner/pilot: $65,000 annually, paid biweekly (26 periods; $2,500 per period). Payroll is informational; no expenses are deducted in this version.
- Starting reputation: neutral, 50/100. Missions and flight hours start at zero.
- An operational clock, initially June 1, 2026 at 08:00 UTC. This is a fixed game date, not the current date. Settings can deliberately advance it by 1 hour, 6 hours, 1 day, or 7 days. Real time, browser reloads and time spent away never advance it. Flight completion is not implemented yet.
- Automatic local saves after creation and every change. Rename the company without resetting anything. Export a versioned JSON backup from Settings or Dashboard. Backup import is not implemented yet; keep exports for future recovery tooling.

## Manual acceptance checks

1. Create a company; confirm $25,000, PADQ, an owned Caravan, airworthy status, zero missions and hours, and one owner/pilot in Settings.
2. Rename the company in Settings. Return to Dashboard and refresh: the new name and all balances should remain.
3. Leave the tab open or close and reopen it: the operational date must not change. Advance by one day in Settings: exactly 24 hours should be added, with no cash deduction.
4. Export a backup. Check that the JSON contains `version: 1`, company, aircraft, pilots, and `operationalTime` matching the screen.
5. Check all navigation destinations; Dispatch, Flight Operations, Finances and Flight Logbook should be clearly marked as future features.
6. Test portrait/landscape Safari on iPad and a narrow phone screen. Navigation collapses to a menu on phones; forms have labels and controls support keyboard focus.
7. In a separate browser profile, block site storage. A save failure should show a warning and offer export; it must not claim the game is saved. A corrupt existing save should produce a recovery warning rather than silently overwrite it.

Automated validation includes four domain tests and a production build. The implementation was also checked in Chromium with touch emulation at 1024, 768 and 390px: creation, renaming, deliberate clock advancement, reload persistence, backup download, mobile navigation and horizontal overflow. Real iPad Safari remains a device acceptance check.

## Free static hosting

No backend, credentials, or paid services are required. Push this repository to GitHub, then connect it to a free static host such as Cloudflare Pages or Netlify:

- Framework: Vite / React
- Install: `npm ci`
- Build: `npm run build`
- Output/publish directory: `dist`
- Use Node.js 22 or newer.

For GitHub Pages, build with `npm ci && npm run build` in Actions and upload/deploy `dist` using the official Pages actions. The Vite `base: './'` configuration supports repository subpaths. Navigation uses application state, so no server-side route fallback is necessary. Never deploy `node_modules` or the development server. Verify the deployed HTTPS site on Safari with the manual checks above.

Local saves belong to the browser profile **and origin** (scheme, host and port). A new deployment domain, changing ports, another device, private browsing, or cleared site data will not carry the save across. Export before clearing storage or switching sites. Cloud sync and backup import are planned, not available.

## Architecture

- `src/game.ts`: versioned game model, initial state, pure time advancement, save validation, and a local save repository adapter. Future cloud storage can implement this boundary. Aircraft and pilots are arrays to accommodate later expansion.
- `src/main.tsx`: company creation, workspace navigation, dashboard, fleet and settings. All current game mutations pass through one save function.
- `src/style.css`: responsive tablet/desktop/phone interface. Decorative landscape is inline SVG; no map service is required. Optional Google Fonts fall back to system fonts when unavailable.
- `src/game.test.ts`: domain and persistence regression tests.

Future work: story cargo and passenger missions, flight completion, interactive Caravan checklists, chart access, separate pilot accounts, operational-time payroll, hiring, aircraft purchases and multiple bases. No advanced gameplay or live simulator telemetry is implemented in this foundation.
