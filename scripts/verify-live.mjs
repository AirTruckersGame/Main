// Opt-in, read-only check against a running Vite/Vercel endpoint. No company save writes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const base = process.env.AIRTRUCKERS_LIVE_BASE_URL ?? 'http://localhost:5173';
const findings = { checkedAt: new Date().toISOString(), base, weather: {}, charts: null, pdf: null };
async function request(parameters) {
  const url = new URL('/api/efb', base); for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  assert.equal(response.status, 200, `${url}: ${response.status} ${response.ok ? '' : await response.text()}`);
  return response;
}
for (const kind of ['metar', 'taf']) {
  const data = await (await request({ action: 'weather', airport: 'PADQ', kind })).json();
  assert.equal(data.status, 'available'); assert.equal(data.airport, 'PADQ'); assert.equal(data.kind, kind);
  assert.match(data.raw, /\bPADQ\b/); assert(Number.isFinite(Date.parse(data.reportTime))); assert(Number.isFinite(Date.parse(data.retrievedAt)));
  findings.weather[kind] = { raw: data.raw, reportTime: data.reportTime, retrievedAt: data.retrievedAt };
}
const missing = await (await request({ action: 'weather', airport: 'PALB', kind: 'taf' })).json();
assert(['missing', 'available'].includes(missing.status));
findings.weather.palbTaf = { status: missing.status, note: missing.status === 'missing' ? 'No Report (live absence)' : 'A report now exists; absence is covered by deterministic tests.' };
const catalog = await (await request({ action: 'charts', airport: 'PADQ' })).json();
assert.equal(catalog.status, 'current'); assert(catalog.charts.some(c => c.type === 'APD'));
assert(Date.parse(catalog.effectiveFrom) <= Date.now() && Date.now() < Date.parse(catalog.effectiveTo));
const approach = catalog.charts.find(chart => chart.type === 'IAP'); assert(approach, 'No actual approach in current PADQ catalog.');
assert.match(approach.url, /^https:\/\/aeronav\.faa\.gov\/d-tpp\/\d{4}\/[a-zA-Z0-9_-]+\.PDF$/i);
findings.charts = { cycle: catalog.cycle, effectiveFrom: catalog.effectiveFrom, effectiveTo: catalog.effectiveTo, records: catalog.charts.map(({ title, type, url }) => ({ title, type, url })) };
const response = await request({ action: 'pdf', airport: 'PADQ', url: approach.url });
assert.match(response.headers.get('content-type'), /application\/pdf/);
const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
findings.pdf = { title: approach.title, source: approach.url, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
console.log(JSON.stringify(findings, null, 2));
