// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { contracts, type Contract } from './missions';
import { createGame } from './game';
import { destinationTheme, missionSymbol, weatherVisual } from './missionPresentation';
import { clearMissionWeatherCache, fetchMissionWeather } from './missionWeather';
import { ActiveMissionHero, MissionIcon, RouteWeather } from './MissionVisuals';
import type { WeatherReport } from './efbData';
const time = Date.parse('2026-11-03T02:00:00Z');
const metar = (raw: string): WeatherReport => ({ airport: 'PADQ', kind: 'metar', status: 'available', raw, reportTime: new Date(time).toISOString(), retrievedAt: new Date(time).toISOString() });
const assignment = (title: string, payload: string, type: Contract['type'] = 'Cargo'): Contract => ({ ...contracts[0], title, payload, type });
beforeEach(() => {
  clearMissionWeatherCache();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const airport = new URL(url, 'http://localhost').searchParams.get('airport');
    return new Response(JSON.stringify({ airport, kind: 'metar', status: 'missing', retrievedAt: new Date().toISOString() }));
  }));
});
afterEach(() => { cleanup(); clearMissionWeatherCache(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('mission symbols', () => {
  it.each([
    ['General delivery', 'Sealed crates', 'Cargo', 'cargo'], ['Workshop visit', 'Tools', 'Cargo', 'tools'],
    ['Clinic supplies', 'Sterile dressings', 'Cargo', 'medical'], ['Lighting delivery', 'Electrical fittings', 'Cargo', 'utility'],
    ['Charter guests', '4 passengers and bags', 'Passenger charter', 'people'], ['Archive delivery', 'Business records', 'Cargo', 'documents'],
    ['Cannery shipment', 'Packed fish', 'Cargo', 'fish'], ['Reading room', 'Library books', 'Cargo', 'education'],
  ] as const)('uses a labeled %s icon', (title, payload, type, kind) => {
    const contract = assignment(title, payload, type); const symbol = missionSymbol(contract);
    expect(symbol.kind).toBe(kind); render(<MissionIcon contract={contract}/>);
    expect(screen.getByRole('img', { name: symbol.label })).toBeTruthy();
  });
});
describe('read-only METAR visual interpretation', () => {
  it.each([
    ['00000KT 10SM CLR', 'clear'], ['00000KT 10SM BKN025 OVC040', 'cloud'], ['00000KT 10SM -RA OVC020', 'rain'],
    ['00000KT 5SM -SN OVC020', 'snow'], ['00000KT 1/2SM FG OVC003', 'fog'], ['23024G32KT 10SM CLR', 'wind'], ['00000KT 10SM OVC008', 'caution'],
  ] as const)('classifies %s from the actual raw report', (body, kind) => {
    expect(weatherVisual(metar(`METAR PADQ 030200Z ${body} 06/04 A2992`), time).kind).toBe(kind);
  });
  it('distinguishes exact No Report and Data Unavailable states', () => {
    expect(weatherVisual({ ...metar(''), status: 'missing' }, time).label).toBe('No Report');
    expect(weatherVisual({ ...metar(''), status: 'unavailable' }, time).label).toBe('Data Unavailable');
  });
  it('keeps wind/caution qualifiers alongside rain and handles mixed fractional visibility', () => {
    const result = weatherVisual(metar('METAR PADQ 030200Z 12026G35KT 2 1/2SM -RA OVC008'), time);
    expect(result.kind).toBe('fog'); expect(result.windy).toBe(true); expect(result.caution).toBe(true);
    expect(weatherVisual(metar('METAR PADQ 030200Z 12026G35KT 8SM -RA BKN017'), time)).toMatchObject({ kind: 'rain', windy: true });
  });
  it('never presents old/future-dated or undated reports as current clear conditions', () => {
    const raw = metar('METAR PADQ 030200Z 00000KT 10SM CLR');
    expect(weatherVisual(raw, time + 3 * 3600000)).toMatchObject({ kind: 'caution', label: 'Check report age' });
    expect(weatherVisual(raw, time - 3600000).kind).toBe('caution');
    expect(weatherVisual({ ...raw, reportTime: undefined }, time)).toMatchObject({ kind: 'report', label: 'METAR available' });
    expect(weatherVisual(metar('Uninterpretable raw report'), time).kind).toBe('report');
  });
  it('does not infer weather from remarks, customer narratives or nearby stations', async () => {
    expect(weatherVisual(metar('METAR PADQ 030200Z 00000KT 10SM CLR RMK RAB22 SNE20'), time).kind).toBe('clear');
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ airport: 'PANC', kind: 'metar', status: 'available', raw: 'METAR PANC CLR' })));
    expect((await fetchMissionWeather('PADQ')).status).toBe('unavailable');
  });
});
describe('compact weather requests and hero presentation', () => {
  it('deduplicates airport requests and caches them across cards', async () => {
    const values = await Promise.all([fetchMissionWeather('PADQ'), fetchMissionWeather('PADQ')]);
    expect(values[0]).toEqual(values[1]); expect(fetch).toHaveBeenCalledTimes(1);
    await fetchMissionWeather('PADQ'); expect(fetch).toHaveBeenCalledTimes(1);
    clearMissionWeatherCache(); await fetchMissionWeather('PADQ'); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('treats HTTP/JSON/network failures as unavailable without touching game storage', async () => {
    const save = vi.spyOn(Storage.prototype, 'setItem');
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'));
    expect((await fetchMissionWeather('PADQ')).status).toBe('unavailable'); expect(save).not.toHaveBeenCalled();
  });
  it('maps five airports to representative scenes and provides a truthful unknown-destination fallback', () => {
    const scenes = ['PADQ', 'PALB', 'PAKH', 'PAHO', 'PAEN'].map(code => destinationTheme(code).scene);
    expect(new Set(scenes).size).toBe(5); expect(destinationTheme('PANC').name).toBe('Alaska aviation landscape');
  });
  it('shows the accepted destination, unchanged payout/payload, illustration label and accessible route weather', async () => {
    const contract = contracts[0]; const before = JSON.stringify(contract);
    render(<ActiveMissionHero contract={contract} actions={<button>Open Flight Operations</button>}/>);
    expect(screen.getByRole('region', { name: 'Active mission destination' })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Illustrative Larsen Bay.*not an airport diagram/ })).toBeTruthy();
    expect(screen.getAllByText('PALB').length).toBeGreaterThan(0); expect(screen.getByText('Larsen Bay')).toBeTruthy();
    expect(screen.getByText('$1,450')).toBeTruthy(); expect(screen.getByText('780 lb')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText('No Report')).toHaveLength(2));
    expect(screen.getByRole('img', { name: /PADQ: No Report/ })).toBeTruthy(); expect(JSON.stringify(contract)).toBe(before);
    expect(fetch).toHaveBeenCalledTimes(2); // Exact departure + destination, not an image service.
  });
  it('refreshes only weather, leaving the assignment and company state unchanged', async () => {
    const game = createGame('Visual test', 'visual-seed'); const contract = game.dispatch.boards.PADQ.offers[0], before = JSON.stringify(game);
    const changed = vi.fn(); render(<ActiveMissionHero contract={contract} actions={<button onClick={changed}>Flight Bag</button>}/>);
    await waitFor(() => expect(screen.getAllByText('No Report')).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh weather' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4)); expect(changed).not.toHaveBeenCalled(); expect(JSON.stringify(game)).toBe(before);
  });
  it('keeps route indicators compact and labels missing versus failed reports separately', async () => {
    vi.mocked(fetch).mockImplementation(async (url: RequestInfo | URL) => {
      const airport = new URL(String(url), 'http://localhost').searchParams.get('airport');
      return new Response(JSON.stringify({ airport, kind: 'metar', status: airport === 'PADQ' ? 'missing' : 'unavailable', retrievedAt: '' }));
    });
    render(<RouteWeather contract={contracts[0]}/>);
    await screen.findByText('No Report'); await screen.findByText('Data Unavailable');
    expect(screen.getByRole('img', { name: /PALB: Data Unavailable/ })).toBeTruthy();
  });
});
