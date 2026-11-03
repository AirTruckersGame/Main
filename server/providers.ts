import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { airportId, FAA_DTPP, type Chart, type ChartCatalog, type WeatherKind, type WeatherReport, validChart, chartCurrent } from '../src/efbData';
export type Fetcher = typeof fetch;
export async function upstream(url: string, fetcher: Fetcher = fetch): Promise<Response> {
  return fetcher(url, { signal: AbortSignal.timeout(8000), redirect: 'error', headers: { Accept: 'application/json, application/xml, text/html, application/pdf', 'User-Agent': 'AirTruckers-Simulator-EFB/0.4' } });
}
export async function boundedBody(response: Response, max: number): Promise<Uint8Array> {
  if (Number(response.headers.get('content-length')) > max) throw new Error('Provider response is too large.');
  const reader = response.body?.getReader(); if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > max) throw new Error('Provider response is too large.'); chunks.push(value); } }
  finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; } return bytes;
}
export class ProviderError extends Error { constructor(message: string, public retryAfter = 15) { super(message); } }
export function checkResponse(response: Response) {
  if (response.status === 429) { const seconds = Number(response.headers.get('retry-after')); throw new ProviderError('Provider rate limit; retry later.', Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 300) : 60); }
  if (!response.ok) throw new ProviderError(`Provider returned HTTP ${response.status}.`);
}
export function decodeWeather(data: unknown, airport: string, kind: WeatherKind, retrievedAt: string): WeatherReport {
  if (!Array.isArray(data)) throw new Error('Unexpected weather response.');
  if (data.length === 0) return { status: 'missing', airport, kind, retrievedAt };
  const exact = data.filter(item => item && item.icaoId === airport);
  if (!exact.length) throw new Error('Provider did not return the requested station; no substitution was made.');
  const item = exact[0]; const raw = kind === 'metar' ? item.rawOb : item.rawTAF;
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('Provider report has no raw text.');
  const decoded: string[] = [];
  if (kind === 'metar') {
    if (typeof item.temp === 'number' && Number.isFinite(item.temp)) decoded.push(`Temperature: ${item.temp} °C`);
    if (typeof item.dewp === 'number' && Number.isFinite(item.dewp)) decoded.push(`Dew point: ${item.dewp} °C`);
    if (typeof item.wspd === 'number' && Number.isFinite(item.wspd) && item.wspd >= 0) decoded.push(`Wind speed: ${item.wspd} kt`);
    if (typeof item.wdir === 'number' && Number.isFinite(item.wdir) && item.wdir >= 0 && item.wdir <= 360) decoded.push(`Wind direction: ${item.wdir}° true`);
    else if (item.wdir === 'VRB') decoded.push('Wind direction: variable');
  }
  const suppliedTime = kind === 'metar' ? (typeof item.obsTime === 'number' ? item.obsTime * 1000 : item.reportTime) : item.issueTime;
  const normalizedTime = kind === 'taf' && typeof suppliedTime === 'number' && suppliedTime < 1e12 ? suppliedTime * 1000 : suppliedTime;
  const parsed = typeof normalizedTime === 'number' || typeof normalizedTime === 'string' ? new Date(normalizedTime) : null;
  return { status: 'available', airport, kind, raw, retrievedAt, decoded, ...(parsed && Number.isFinite(parsed.getTime()) ? { reportTime: parsed.toISOString() } : {}) };
}
export async function getWeather(airport: string, kind: WeatherKind, fetcher: Fetcher = fetch): Promise<WeatherReport> {
  airport = airportId(airport); const retrievedAt = new Date().toISOString();
  const response = await upstream(`https://aviationweather.gov/api/data/${kind}?ids=${airport}&format=json`, fetcher);
  checkResponse(response);
  if (response.status === 204) return { status: 'missing', airport, kind, retrievedAt };
  return decodeWeather(JSON.parse(new TextDecoder().decode(await boundedBody(response, 1_000_000))), airport, kind, retrievedAt);
}
export function faaDate(value: unknown): string {
  if (typeof value !== 'string') throw new Error('FAA effective date unavailable.');
  const match = /^(\d{2})(\d{2})Z\s+(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/.exec(value.trim());
  if (!match) throw new Error('Unrecognized FAA effective-date format.');
  const [, hour, minute, month, day, year] = match;
  const fullYear = year.length === 2 ? 2000 + Number(year) : Number(year);
  const result = new Date(Date.UTC(fullYear, +month - 1, +day, +hour, +minute));
  if (result.getUTCFullYear() !== fullYear || result.getUTCMonth() !== +month - 1 || result.getUTCDate() !== +day || +hour > 23 || +minute > 59) throw new Error('Invalid FAA effective date.');
  return result.toISOString();
}
export function parseFaaIndex(xml: string, requestedAirport: string, expectedCycle: string, now = Date.now()): ChartCatalog {
  const airport = airportId(requestedAirport);
  if (xml.includes('<!DOCTYPE') || xml.includes('<!ENTITY') || XMLValidator.validate(xml) !== true) throw new Error('Invalid FAA XML index.');
  const root = new XMLParser({ ignoreAttributes: false, parseTagValue: false, parseAttributeValue: false, processEntities: true }).parse(xml).digital_tpp;
  if (!root || root['@_cycle'] !== expectedCycle) throw new Error('FAA cycle does not match index URL.');
  const effectiveFrom = faaDate(root['@_from_edate']), effectiveTo = faaDate(root['@_to_edate']);
  if (Date.parse(effectiveTo) <= Date.parse(effectiveFrom)) throw new Error('Invalid FAA publication interval.');
  const charts: Chart[] = []; const metadataUrl = `https://aeronav.faa.gov/d-tpp/${expectedCycle}/xml_data/d-tpp_Metafile.xml`;
  function visit(node: unknown) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const value = node as Record<string, unknown>;
    if (value['@_icao_ident'] === airport || value['@_apt_ident'] === airport) {
      const records = Array.isArray(value.record) ? value.record : value.record ? [value.record] : [];
      for (const raw of records) {
        const record = raw as Record<string, unknown>;
        if (typeof record.pdf_name !== 'string' || !/^[a-zA-Z0-9_-]+\.pdf$/i.test(record.pdf_name) || typeof record.chart_name !== 'string' || !['IAP', 'APD', 'DP', 'STAR'].includes(String(record.chart_code))) continue;
        const chart = { airport, title: record.chart_name, type: record.chart_code, cycle: expectedCycle, url: `https://aeronav.faa.gov/d-tpp/${expectedCycle}/${record.pdf_name}`, effectiveFrom, effectiveTo, metadataUrl } as Chart;
        if (validChart(chart) && !charts.some(c => c.url === chart.url && c.title === chart.title)) charts.push(chart);
      }
    }
    Object.values(value).forEach(visit);
  }
  visit(root);
  return { airport, charts, status: Date.parse(effectiveFrom) <= now && now < Date.parse(effectiveTo) ? 'current' : 'outdated', cycle: expectedCycle, effectiveFrom, effectiveTo, retrievedAt: new Date(now).toISOString() };
}
export function discoverCycles(html: string): string[] {
  // Only cycle references actually present on the official FAA product page.
  return [...new Set(Array.from(html.matchAll(/(?:https:\/\/aeronav\.faa\.gov)?\/d-tpp\/(\d{4})\//g), match => match[1]))].sort().reverse().slice(0, 3);
}
export async function getCatalog(airport: string, fetcher: Fetcher = fetch): Promise<ChartCatalog> {
  const page = await upstream(FAA_DTPP, fetcher); checkResponse(page);
  const cycles = discoverCycles(new TextDecoder().decode(await boundedBody(page, 4_000_000)));
  if (!cycles.length) throw new Error('No supported FAA publication index was discovered. Automatic indexing needs verification.');
  let latest: ChartCatalog | undefined;
  for (const cycle of cycles) {
    const index = await upstream(`https://aeronav.faa.gov/d-tpp/${cycle}/xml_data/d-tpp_Metafile.xml`, fetcher);
    if (index.status === 404) continue;
    checkResponse(index);
    const catalog = parseFaaIndex(new TextDecoder().decode(await boundedBody(index, 25_000_000)), airport, cycle);
    if (catalog.status === 'current' && catalog.charts.every(chart => chartCurrent(chart))) return catalog;
    if (!latest || Date.parse(catalog.effectiveFrom!) > Date.parse(latest.effectiveFrom!)) latest = catalog;
  }
  if (latest) return latest;
  throw new Error('FAA publication metadata could not be verified.');
}
