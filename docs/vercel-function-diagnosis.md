# Vercel function startup failure — local reproduction and correction

## Report and confidence boundary

Reported preview response: HTTP 500 `FUNCTION_INVOCATION_FAILED` for `/api/efb?action=weather&airport=PADQ&kind=metar`, request ID `iad1:iad1::cw6sl-1793668048156-bdc62b82c702`.

A concrete startup defect was reproduced in the existing branch using the official `@vercel/node` builder **29.0.1** and `@vercel/build-utils` **15.2.1**, installed outside the checkout. This is confirmed repository behavior, not a guess about provider CORS. The preview's runtime error stack, deployed commit, builder and runtime version were not available, so the specific production request has **not** been conclusively correlated with this local stack. If its log shows another error, that error still needs investigation.

No Vercel project was linked or deployed, and no remote logs were accessed.

## Confirmed defect

The project declares `"type": "module"`. Vercel emits TypeScript server modules as ESM JavaScript; it does not apply Vite's browser bundler resolution to these modules. The original emitted entry contained:

```js
export { default } from '../server/handler';
```

The builder did include `server/handler.js` and the required runtime packages in the artifact, but native Node ESM requires the explicit extension. Cold-loading the unmodified emitted entry failed with:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
'/tmp/airtruckers-function-before-output/server/handler'
imported from /tmp/airtruckers-function-before-output/api/efb.js
```

The remaining server modules also had extensionless relative imports, so fixing only the entry point would leave further startup failures. The error occurs during module linking, before the handler's try/catch can execute. It therefore can yield a platform invocation failure rather than the API's normal JSON 503 `Data Unavailable` response. Vite development and Vitest's usual module loader resolved these paths, hiding the native Node constraint.

No missing `undici` or `fast-xml-parser` dependency was found: both are production dependencies and were included in the traced package. `vercel.json` already declares Vite output, a Node API entry and a 60-second duration; no Edge runtime or catch-all routing change was necessary.

## Corrections

- Explicit `.js` specifiers throughout `api/efb.ts` and the server's runtime/type import graph, including the shared `src/efbData` module. TypeScript resolves these to source `.ts` files; emitted Node ESM resolves the corresponding `.js` files.
- Added `api/tsconfig.json` with NodeNext module/resolution rules; `npm run build` now runs that check first. Browser TypeScript retains its normal Vite/Bundler configuration.
- Pinned `engines.node` to `24.x` in package/lockfile. The previous package had no runtime pin; the local official builder selected its current default Node 26 despite the host running Node 24. That version drift is not the demonstrated module error, but the corrected artifact now explicitly targets the tested `nodejs24.x` runtime.
- Added a native-Node emitted-function regression test that does not use Vite's resolver or a TypeScript execution loader.
- No interface, game state, save format, flight workflow or provider response format changed.

## Local verification

1. Official builder before correction: 160 traced files; emitted `api/efb.js` failed to import with `ERR_MODULE_NOT_FOUND`.
2. Official builder after correction: 160 traced files, `nodejs24.x`, `api/efb.js`; native import succeeded and exported a function.
3. Invoked that actual packaged artifact on a local HTTP server, then ran the existing read-only live verifier against it. It returned:
   - PADQ METAR/SPECI: raw report `SPECI PADQ 030100Z ...`, observed `2026-11-03T01:00:00.000Z`.
   - PADQ TAF: raw report `TAF PADQ 022340Z ...`, issued `2026-11-02T23:40:00.000Z`.
   - PALB TAF: missing (`No Report`).
   - FAA cycle 2611, valid October 29–November 26, 2026, with three PADQ approaches, the airport diagram and two obstacle-departure pages.
   - Actual ILS Y OR LOC Y RWY 26 PDF: HTTP 200, `application/pdf`, 429,182 bytes, SHA-256 `54889544f2f12fcf23ddafde0c11ef337290733ac8b0f9594f9f1f4353767dab`.
4. Full automated suite: **61 tests passed**. Production build passed, including the new NodeNext check. The browser bundle hashes stayed unchanged.

Provider verification was performed November 2, 2026, approximately 8:15 p.m. Eastern (2026-11-03T01:15Z). This is live local testing through Vercel-built output, **not a successful Vercel redeployment claim**.

## Required preview confirmation / exact logs if it still fails

After an approved push/redeployment of the corrected commit:

```sh
AIRTRUCKERS_LIVE_BASE_URL=https://YOUR_PREVIEW_ORIGIN npm run verify:live
```

Confirm that `/api/efb` returns JSON or a PDF, rather than the platform invocation error, and then test the EFB in the browser. Physical iPad Safari/CSP/worker and Vercel egress checks still require that preview/device.

To correlate the reported request or diagnose any further failure, provide from Vercel's **Runtime Logs**, not only the browser error page:

- The first startup error name/message and complete module-loading stack for the request ID above (or the new failed invocation), including any `ERR_MODULE_NOT_FOUND`, `ERR_REQUIRE_ESM`, syntax error, OOM or timeout line.
- Preview URL/deployment ID and deployed Git commit SHA.
- The deployment's selected Node.js version and the build-log section that packages `api/efb.ts` (including builder version if shown).
- If module loading now succeeds but requests fail: response status/body from the weather and charts endpoints, plus the corresponding runtime error entry.

Do not send environment variable values or credentials. A remaining 500 startup error needs its actual stack; a JSON `Data Unavailable` 503 is a different, handled provider/runtime path. The correction has not been pushed, merged or deployed as part of this work.
