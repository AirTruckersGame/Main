import { airportId, validChartUrl, type ChartCatalog, type WeatherKind } from '../src/efbData';
import { boundedBody, checkResponse, getCatalog, getWeather, ProviderError, upstream, type Fetcher } from './providers';
export interface ApiResult { status: number; headers: Record<string, string>; body: unknown; }
const json = (body: unknown, status = 200, headers: Record<string, string> = {}): ApiResult => ({ status, body, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
export function createEfbService(fetcher: Fetcher = fetch) {
  const cache = new Map<string, { until: number; result: ApiResult }>();
  const pending = new Map<string, Promise<ApiResult>>();
  const rates = new Map<string, { reset: number; count: number }>();
  const documents = new Map<string, { until: number; bytes: Uint8Array }>();
  // Shared FAA documents avoid downloading the national index for each airport.
  const documentPending = new Map<string, Promise<Response>>();
  const faaFetcher: Fetcher = async (input, init) => {
    const url = String(input); const saved = documents.get(url);
    if (saved && saved.until > Date.now()) return new Response(saved.bytes.slice());
    const existing = documentPending.get(url); if (existing) return (await existing).clone();
    const request = (async () => {
      const response = await fetcher(input, init);
      if (!response.ok) return response;
      const bytes = await boundedBody(response, 25_000_000);
      if (documents.size >= 4) documents.delete(documents.keys().next().value!);
      documents.set(url, { bytes, until: Date.now() + 3600000 });
      return new Response(bytes.slice());
    })();
    documentPending.set(url, request);
    try { return (await request).clone(); } finally { documentPending.delete(url); }
  };
  async function cached(key: string, ttl: number, run: () => Promise<ApiResult>): Promise<ApiResult> {
    const saved = cache.get(key); if (saved && saved.until > Date.now()) return saved.result;
    if (pending.has(key)) return pending.get(key)!;
    const request = run().then(result => { if (cache.size >= 128) cache.delete(cache.keys().next().value!); const retry = Number(result.headers['Retry-After']); cache.set(key, { result, until: Date.now() + (result.status >= 400 ? (retry || 15) * 1000 : ttl) }); return result; }).finally(() => pending.delete(key));
    pending.set(key, request); return request;
  }
  async function catalog(airport: string): Promise<ApiResult> {
    const result = await cached(`charts:${airport}`, 300000, async () => {
      try { return json(await getCatalog(airport, faaFetcher)); }
      catch (error) { return json({ airport, status: 'unavailable', charts: [], retrievedAt: new Date().toISOString(), message: error instanceof Error ? error.message : 'FAA data unavailable.' }, 503, { 'Retry-After': String(error instanceof ProviderError ? error.retryAfter : 15) }); }
    });
    const data = result.body as ChartCatalog;
    if (data.status === 'unavailable') return result;
    return { ...result, body: { ...data, status: Date.parse(data.effectiveFrom!) <= Date.now() && Date.now() < Date.parse(data.effectiveTo!) ? 'current' : 'outdated' } };
  }
  return async function handle(method: string, url: URL, client = 'local'): Promise<ApiResult> {
    if (method !== 'GET') return json({ error: 'Use GET.' }, 405, { Allow: 'GET' });
    let airport: string;
    const action = url.searchParams.get('action');
    try {
      airport = airportId(url.searchParams.get('airport'));
      const allowed = action === 'weather' ? ['action', 'airport', 'kind'] : action === 'pdf' ? ['action', 'airport', 'url'] : action === 'charts' ? ['action', 'airport'] : [];
      if (!allowed.length || [...url.searchParams.keys()].some(key => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1)) throw new Error('Invalid request parameters.');
      if (action === 'weather' && !['metar', 'taf'].includes(url.searchParams.get('kind') ?? '')) throw new Error('Use metar or taf.');
      if (action === 'pdf' && !validChartUrl(url.searchParams.get('url'))) throw new Error('Invalid official FAA PDF URL.');
    } catch (error) { return json({ error: (error as Error).message }, 400); }
    const now = Date.now(); let rate = rates.get(client);
    if (!rate || rate.reset <= now) { if (rates.size >= 256) rates.delete(rates.keys().next().value!); rate = { reset: now + 60000, count: 0 }; rates.set(client, rate); }
    if (++rate.count > 60) return json({ error: 'Too many requests. Please wait before refreshing.' }, 429, { 'Retry-After': String(Math.ceil((rate.reset - now) / 1000)) });
    if (action === 'weather') {
      const kind = url.searchParams.get('kind') as WeatherKind;
      return cached(`weather:${airport}:${kind}`, 60000, async () => {
        try { return json(await getWeather(airport, kind, fetcher)); }
        catch (error) { return json({ status: 'unavailable', airport, kind, retrievedAt: new Date().toISOString(), message: error instanceof Error ? error.message : 'Weather data unavailable.' }, 503, { 'Retry-After': String(error instanceof ProviderError ? error.retryAfter : 15) }); }
      });
    }
    if (action === 'charts') return catalog(airport);
    const result = await catalog(airport); const data = result.body as ChartCatalog;
    const pdfUrl = url.searchParams.get('url')!;
    if (data.status === 'unavailable') return json({ error: 'FAA chart membership could not be verified. Use the official FAA fallback link.' }, 503);
    if (!data.charts.some(chart => chart.url === pdfUrl)) return json({ error: 'This PDF is not in the verified airport catalog. It may belong to an older cycle.' }, 410);
    try {
      const response = await upstream(pdfUrl, fetcher); checkResponse(response);
      const bytes = await boundedBody(response, 20_000_000);
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('FAA response is not a PDF.');
      return { status: 200, headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' }, body: bytes };
    } catch (error) { return json({ error: error instanceof Error ? error.message : 'FAA PDF unavailable.' }, 503); }
  };
}
