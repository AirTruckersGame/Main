import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { airportId, chartCurrent, pdfEndpoint, validChartUrl, weatherLabel, type Chart } from './efbData';
import { acceptMission, cancelMission, createGame, localSaveRepository, parseSave, pinApproach, submitFlightReport, reportFor } from './game';
import { decodeWeather, discoverCycles, faaDate, getWeather, parseFaaIndex } from '../server/providers';
import { createEfbService } from '../server/service';
const xml = readFileSync(new URL('../tests/fixtures/dtpp-test.xml', import.meta.url), 'utf8');
const now = Date.parse('2026-11-02T12:00:00Z');
const catalog = () => parseFaaIndex(xml, 'PADQ', '2611', now);
const fixtureFetch = (data: unknown, status = 200) => vi.fn(async () => new Response(status === 204 ? null : JSON.stringify(data), { status }));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('AWC weather and exact station handling', () => {
  it('normalizes airport IDs without guessing ICAO prefixes or substituting stations', () => {
    expect(airportId(' padq ')).toBe('PADQ'); expect(airportId('4k5')).toBe('4K5'); expect(airportId('ADQ')).toBe('ADQ');
    for (const value of ['', 'P', 'PADQ,PAKH', 'https://evil.test', '../PADQ', undefined]) expect(() => airportId(value)).toThrow();
  });
  it('labels empty/204 METAR and TAF reports exactly No Report', async () => {
    for (const kind of ['metar', 'taf'] as const) {
      expect(weatherLabel((await getWeather('PADQ', kind, fixtureFetch([]))).status)).toBe('No Report');
      expect(weatherLabel((await getWeather('PADQ', kind, fixtureFetch([], 204))).status)).toBe('No Report');
    }
  });
  it('preserves raw reports and decodes only supplied, finite fields with UTC timestamps', () => {
    const report = decodeWeather([{ icaoId: 'PADQ', rawOb: 'TEST METAR RAW', obsTime: 1793620800, temp: 3, dewp: 1, wspd: 12, wdir: 'VRB' }], 'PADQ', 'metar', new Date(now).toISOString());
    expect(report.raw).toBe('TEST METAR RAW'); expect(report.decoded).toContain('Temperature: 3 °C'); expect(report.decoded).toContain('Wind direction: variable'); expect(report.reportTime).toMatch(/Z$/);
    const taf = decodeWeather([{ icaoId: 'PADQ', rawTAF: 'TEST TAF RAW', issueTime: '2026-11-02T10:00:00Z' }], 'PADQ', 'taf', new Date(now).toISOString());
    expect(taf.reportTime).toBe('2026-11-02T10:00:00.000Z'); expect(taf.decoded).toEqual([]);
    expect(() => decodeWeather([{ icaoId: 'PANC', rawOb: 'OTHER STATION' }], 'PADQ', 'metar', '')).toThrow('no substitution');
    expect(() => decodeWeather({ rawOb: 'invalid shape' }, 'PADQ', 'metar', '')).toThrow();
  });
  it('retrieves METAR and TAF independently and treats provider errors as Data Unavailable', async () => {
    const fetcher = vi.fn(async (url: unknown) => String(url).includes('/metar?') ? new Response(JSON.stringify([{ icaoId: 'PADQ', rawOb: 'TEST METAR' }])) : new Response('unavailable', { status: 500 }));
    const service = createEfbService(fetcher);
    const metar = await service('GET', new URL('https://local/api/efb?action=weather&airport=PADQ&kind=metar'));
    const taf = await service('GET', new URL('https://local/api/efb?action=weather&airport=PADQ&kind=taf'));
    expect((metar.body as { status: string }).status).toBe('available');
    expect(weatherLabel((taf.body as { status: 'unavailable' }).status)).toBe('Data Unavailable');
    expect(taf.status).toBe(503); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('caches/coalesces requests and honors provider retry-after without retry loops', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 429, headers: { 'Retry-After': '120' } }));
    const service = createEfbService(fetcher); const url = new URL('https://local/?action=weather&airport=PADQ&kind=metar');
    const results = await Promise.all([service('GET', url), service('GET', url)]);
    expect(results[0].headers['Retry-After']).toBe('120'); expect(fetcher).toHaveBeenCalledTimes(1);
    await service('GET', url); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('validates methods, query duplication, kind, station, and PDF URLs before fetching', async () => {
    const fetcher = fixtureFetch([]); const service = createEfbService(fetcher);
    for (const query of ['action=weather&airport=PADQ&kind=bogus', 'action=charts&airport=../', 'action=weather&airport=PADQ&airport=PANC&kind=metar', 'action=pdf&airport=PADQ&url=https://evil.test/test.pdf']) expect((await service('GET', new URL(`https://local/?${query}`))).status).toBe(400);
    expect((await service('POST', new URL('https://local/?action=charts&airport=PADQ'))).status).toBe(405); expect(fetcher).not.toHaveBeenCalled();
  });
});
describe('FAA metadata-derived chart catalog (synthetic parser fixture, not live FAA data)', () => {
  it('uses only supplied official-page cycle references and exact airport records', () => {
    expect(discoverCycles('<a href="https://aeronav.faa.gov/d-tpp/2611/xml_data/d-tpp_Metafile.xml">XML</a>')).toEqual(['2611']);
    expect(discoverCycles('No publication metadata')).toEqual([]);
    const result = catalog(); expect(result.status).toBe('current'); expect(result.charts).toHaveLength(4);
    expect(result.charts.map(c => c.type)).toEqual(['IAP', 'APD', 'DP', 'STAR']);
    expect(result.charts[0]).toMatchObject({ title: 'TEST APPROACH - FIXTURE ONLY', url: 'https://aeronav.faa.gov/d-tpp/2611/TESTONLY.PDF', effectiveFrom: '2026-10-29T09:01:00.000Z', effectiveTo: '2026-11-26T09:01:00.000Z' });
    expect(parseFaaIndex(xml, 'PANC', '2611', now).charts).toEqual([]); expect(parseFaaIndex(xml, 'ADQ', '2611', now).charts).toHaveLength(4);
  });
  it('rejects invalid dates, cycles, external paths and entities; labels expired cycles outdated', () => {
    expect(() => faaDate('0901Z 02/31/26')).toThrow(); expect(() => parseFaaIndex(xml, 'PADQ', '2612', now)).toThrow();
    expect(() => parseFaaIndex('<!DOCTYPE x>'+xml, 'PADQ', '2611', now)).toThrow();
    expect(parseFaaIndex(xml, 'PADQ', '2611', Date.parse('2027-01-01')).status).toBe('outdated');
    for (const url of ['https://evil.test/d-tpp/2611/TEST.PDF', 'javascript:alert(1)', 'https://aeronav.faa.gov/d-tpp/2611/../TEST.PDF', 'https://aeronav.faa.gov/d-tpp/2611/TEST.PDF?url=x']) expect(validChartUrl(url)).toBe(false);
  });
  it('returns catalog errors, never fake chart names, if metadata cannot be discovered', async () => {
    const service = createEfbService(vi.fn(async () => new Response('<html>No XML link</html>')));
    const result = await service('GET', new URL('https://local/?action=charts&airport=PADQ'));
    expect(result.status).toBe(503); expect((result.body as { charts: Chart[] }).charts).toEqual([]); expect((result.body as { status: string }).status).toBe('unavailable');
  });
  it('proxies PDFs only from the selected airport catalog and checks PDF signatures', async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const fetcher = vi.fn(async (url: unknown) => {
      if (String(url).endsWith('/dtpp/search/')) return new Response('<a href="https://aeronav.faa.gov/d-tpp/2611/xml_data/d-tpp_Metafile.xml">Index</a>');
      if (String(url).endsWith('.xml')) return new Response(xml);
      return new Response('%PDF-1.4\nTEST FIXTURE ONLY');
    });
    const service = createEfbService(fetcher); const chart = catalog().charts[0];
    const result = await service('GET', new URL(pdfEndpoint(chart), 'https://local'));
    expect(result.status).toBe(200); expect(result.headers['Content-Type']).toBe('application/pdf');
    const absent = await service('GET', new URL(pdfEndpoint({ ...chart, url: chart.url.replace('TESTONLY', 'NOTININDEX') }), 'https://local'));
    expect(absent.status).toBe(410);
    const otherAirport = await service('GET', new URL(pdfEndpoint({ ...chart, airport: 'PANC' }), 'https://local'));
    expect(otherAirport.status).toBe(410);
  });
});
describe('mission approach pins and migrations', () => {
  it('persists metadata-derived approach selection in local storage and JSON without company/flight effects', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('navigator', {});
    const store = new Map<string, string>(); vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) });
    const game = acceptMission(createGame('Test'), 'kodiak-01'); localSaveRepository.save(game);
    const next = pinApproach(game, catalog().charts[0], catalog(), now);
    for (const key of ['company', 'aircraft', 'operationalTime', 'flightHours', 'completedMissions', 'pendingReport', 'logbook'] as const) expect(next[key]).toEqual(game[key]);
    await localSaveRepository.commit(game, next); expect(localSaveRepository.load()?.pinnedApproach).toEqual(next.pinnedApproach);
    expect(parseSave(JSON.stringify(next))).toEqual(next);
  });
  it('rejects diagrams, stale/unlisted/foreign links and mismatched mission pins', () => {
    const game = acceptMission(createGame('Test'), 'kodiak-01'); const result = catalog(); const chart = result.charts[0];
    expect(() => pinApproach(game, result.charts[1], result, now)).toThrow();
    expect(() => pinApproach(game, { ...chart, title: 'Invented approach' }, result, now)).toThrow();
    expect(() => pinApproach(game, chart, result, Date.parse('2027-01-01'))).toThrow();
    expect(() => pinApproach(game, { ...chart, airport: 'PANC' }, result, now)).toThrow();
    const pinned = pinApproach(game, chart, result, now);
    expect(() => parseSave(JSON.stringify({ ...pinned, pinnedApproach: { ...pinned.pinnedApproach, flightId: 'another-flight' } }))).toThrow('Invalid pinned');
    const expired = parseSave(JSON.stringify(pinned)); expect(expired.pinnedApproach).not.toBeNull(); expect(chartCurrent(chart, Date.parse('2027-01-01'))).toBe(false);
    expect(cancelMission(pinned).pinnedApproach).toBeNull();
    expect(submitFlightReport(pinned, { ...reportFor(pinned), minutes: '30' }).pinnedApproach).toBeNull();
  });
  it('adds an empty pin to older v0.3 saves, retaining pending reports and logbook', () => {
    const game = acceptMission(createGame('Test'), 'kodiak-01');
    game.pendingReport = { ...reportFor(game), minutes: '45', notes: 'Saved before upgrade' };
    const { pinnedApproach: _, ...old } = game;
    expect(parseSave(JSON.stringify(old))).toEqual({ ...old, pinnedApproach: null });
    const finished = submitFlightReport(game, game.pendingReport);
    const { pinnedApproach: _pin, ...oldFinished } = finished;
    expect(parseSave(JSON.stringify(oldFinished)).logbook).toEqual(finished.logbook);
  });
});

describe('recorded official AWC / FAA responses (historical regression fixtures)', () => {
  const search = readFileSync(new URL('../tests/fixtures/faa-search-2026-11.html', import.meta.url), 'utf8');
  const padqXml = readFileSync(new URL('../tests/fixtures/faa-padq-2611.xml', import.meta.url), 'utf8');
  it('discovers the explicit XML link, not unrelated navigation cycles or ZIP dates', () => {
    expect(discoverCycles(search + '<a href="https://aeronav.faa.gov/d-tpp/2699/frntmatter.pdf">Unrelated</a>')).toEqual(['2611']);
    expect(discoverCycles('<a href="https://aeronav.faa.gov/upload_313-d/terminal/DDTPPE_261029.zip">ZIP</a>')).toEqual([]);
  });
  it('parses actual PADQ approaches, airport diagram and obstacle departures from FAA XML', () => {
    const data = parseFaaIndex(padqXml, 'PADQ', '2611', now);
    expect(data.charts.filter(chart => chart.type === 'IAP').map(chart => chart.title)).toEqual(['ILS Y OR LOC Y RWY 26', 'RNAV (GPS) RWY 26', 'VOR RWY 26']);
    expect(data.charts.find(chart => chart.type === 'APD')?.url).toBe('https://aeronav.faa.gov/d-tpp/2611/01238AD.PDF');
    expect(data.charts.filter(chart => chart.type === 'ODP')).toHaveLength(2);
    expect(data.status).toBe('current');
    expect(parseFaaIndex(padqXml, 'PADQ', '2611', Date.parse('2026-11-26T09:01:00Z')).status).toBe('outdated');
  });
  it('parses actual recorded AWC raw text and observation/issue UTC timestamps without invention', () => {
    for (const kind of ['metar', 'taf'] as const) {
      const records = JSON.parse(readFileSync(new URL(`../tests/fixtures/awc-padq-${kind}-2026-11.json`, import.meta.url), 'utf8'));
      const result = decodeWeather(records, 'PADQ', kind, new Date(now).toISOString());
      expect(result.raw).toBe(kind === 'metar' ? records[0].rawOb : records[0].rawTAF);
      expect(result.reportTime).toBe(kind === 'metar' ? '2026-11-02T23:53:00.000Z' : '2026-11-02T23:40:00.000Z');
    }
  });
  it('uses the verified FAA search-page path and wildcard Accept header through the full service', async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const fetcher = vi.fn(async (url: unknown, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).Accept).toBe('*/*');
      if (String(url).endsWith('/dtpp/search/')) return new Response(search);
      if (String(url).endsWith('/2611/xml_data/d-tpp_Metafile.xml')) return new Response(padqXml);
      throw new Error('Unexpected provider URL');
    });
    const service = createEfbService(fetcher);
    const result = await service('GET', new URL('https://local/api/efb?action=charts&airport=PADQ'));
    expect(result.status).toBe(200); expect((result.body as { charts: Chart[] }).charts).toHaveLength(6);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
