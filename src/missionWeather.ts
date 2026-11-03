import { useEffect, useState } from 'react';
import type { WeatherReport } from './efbData';
const reports = new Map<string, { until: number; report: WeatherReport }>();
const pending = new Map<string, Promise<WeatherReport>>();
export function clearMissionWeatherCache() { reports.clear(); }
export function fetchMissionWeather(airport: string): Promise<WeatherReport> {
  const cached = reports.get(airport); if (cached && cached.until > Date.now()) return Promise.resolve(cached.report);
  const current = pending.get(airport); if (current) return current;
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
  const request = fetch(`/api/efb?action=weather&airport=${encodeURIComponent(airport)}&kind=metar`, { signal: controller.signal }).then(async response => {
    const value = await response.json() as WeatherReport;
    if (!value || value.airport !== airport || value.kind !== 'metar' || !['available', 'missing', 'unavailable'].includes(value.status) || (value.status === 'available' && (typeof value.raw !== 'string' || !value.raw.trim())) || (!response.ok && value.status !== 'unavailable')) throw new Error('Unusable METAR response');
    return value;
  }).catch((): WeatherReport => ({ airport, kind: 'metar', status: 'unavailable', retrievedAt: '', message: 'Unable to retrieve exact-airport METAR.' })).then(report => {
    if (reports.size >= 20) reports.delete(reports.keys().next().value!);
    reports.set(airport, { report, until: Date.now() + (report.status === 'unavailable' ? 15000 : 60000) }); return report;
  }).finally(() => { clearTimeout(timer); pending.delete(airport); });
  pending.set(airport, request); return request;
}
export function useMissionWeather(airport: string, refresh: number) {
  const [value, setValue] = useState<{ airport: string; report: WeatherReport | null; now: number }>({ airport, report: null, now: Date.now() });
  useEffect(() => {
    let cancelled = false;
    function load() { void fetchMissionWeather(airport).then(report => { if (!cancelled) setValue({ airport, report, now: Date.now() }); }); }
    load();
    const reload = setInterval(load, 300000);
    const age = setInterval(() => { if (!cancelled) setValue(previous => ({ ...previous, now: Date.now() })); }, 60000);
    return () => { cancelled = true; clearInterval(reload); clearInterval(age); };
  }, [airport, refresh]);
  return value.airport === airport ? value : { airport, report: null, now: Date.now() };
}
