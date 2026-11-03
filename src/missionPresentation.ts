import type { Contract } from './missions';
import type { WeatherReport } from './efbData';
export type MissionSymbol = 'cargo' | 'tools' | 'medical' | 'utility' | 'people' | 'documents' | 'fish' | 'education';
export function missionSymbol(contract: Contract): { kind: MissionSymbol; label: string } {
  const text = `${contract.generated?.category ?? ''} ${contract.generated?.templateId ?? ''} ${contract.title} ${contract.payload}`.toLowerCase();
  if (contract.type === 'Passenger charter') return { kind: 'people', label: 'Passenger charter' };
  if (/medical|clinic|dressings|diagnostic|mobility/.test(text)) return { kind: 'medical', label: 'Medical logistics' };
  if (/workshop|tools|hardware|bearings|pump/.test(text)) return { kind: 'tools', label: 'Tools and maintenance cargo' };
  if (/lighting|electrical|generator|water-system|water crew/.test(text)) return { kind: 'utility', label: 'Utility supplies' };
  if (/documents|records|mail|signed originals/.test(text)) return { kind: 'documents', label: 'Documents and records' };
  if (/school|classroom|books|library|education/.test(text)) return { kind: 'education', label: 'Education supplies' };
  if (/seafood|fish|cannery/.test(text)) return { kind: 'fish', label: 'Seafood and cannery freight' };
  return { kind: 'cargo', label: 'General freight' };
}
export type WeatherSymbol = 'clear' | 'cloud' | 'rain' | 'snow' | 'fog' | 'wind' | 'caution' | 'missing' | 'unavailable' | 'report';
export interface WeatherVisual { kind: WeatherSymbol; label: string; windy: boolean; caution: boolean; detail: string }
// Display-only interpretation of an observed METAR. This is not a flight-category
// certification, forecast, simulator-weather claim or go/no-go recommendation.
export function weatherVisual(report: WeatherReport, now = Date.now()): WeatherVisual {
  const base = { windy: false, caution: false, detail: '' };
  if (report.status === 'missing') return { ...base, kind: 'missing', label: 'No Report' };
  if (report.status === 'unavailable' || !report.raw) return { ...base, kind: 'unavailable', label: 'Data Unavailable' };
  const observed = Date.parse(report.reportTime ?? '');
  if (!Number.isFinite(observed)) return { ...base, kind: 'report', label: 'METAR available', detail: 'Observation time unavailable; check the raw report in Flight Bag.' };
  if (now - observed > 2 * 3600000 || observed > now + 600000) return { ...base, kind: 'caution', caution: true, label: 'Check report age', detail: `Observed ${report.reportTime} (UTC); not shown as current conditions.` };
  const raw = report.raw.split(/\sRMK\b/)[0];
  const tokens = raw.split(/\s+/);
  const phenomena = tokens.filter(t => /^[+-]?(?:VC)?(?:MI|PR|BC|DR|BL|SH|TS|FZ)?(?:DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY)+$/.test(t));
  const wind = /\b(?:\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT\b/.exec(raw);
  const windy = Boolean(wind && (+wind[1] >= 20 || +(wind[2] ?? 0) >= 25));
  const visibility = /(?:^|\s)(?:(\d+) )?(P|M)?(\d+)(?:\/(\d+))?SM\b/.exec(raw);
  let miles: number | undefined;
  if (visibility) miles = +(visibility[1] ?? 0) + +visibility[3] / +(visibility[4] ?? 1);
  const ceilings = [...raw.matchAll(/\b(?:BKN|OVC|VV)(\d{3})\b/g)].map(m => +m[1] * 100);
  const caution = (miles !== undefined && miles < 3) || ceilings.some(feet => feet < 1000) || phenomena.some(t => /TS|FZ|PL|GR/.test(t));
  let kind: WeatherSymbol = 'report', label = 'METAR available';
  if (phenomena.some(t => /FG|BR|HZ|FU/.test(t)) || (miles !== undefined && miles < 3)) { kind = 'fog'; label = 'Reduced visibility'; }
  else if (phenomena.some(t => /SN|SG|IC/.test(t))) { kind = 'snow'; label = 'Snow / ice reported'; }
  else if (phenomena.some(t => /RA|DZ/.test(t))) { kind = 'rain'; label = 'Rain reported'; }
  else if (caution) { kind = 'caution'; label = 'Weather caution'; }
  else if (windy) { kind = 'wind'; label = 'Windy / gusty'; }
  else if (/\b(?:BKN|OVC|SCT|FEW)\d{3}/.test(raw)) { kind = 'cloud'; label = 'Cloud reported'; }
  else if (/\b(?:CLR|SKC|NSC|CAVOK)\b/.test(raw)) { kind = 'clear'; label = 'Clear reported'; }
  return { kind, label, windy, caution, detail: `Observed ${report.reportTime} (UTC).${windy ? ' Wind/gust indicator: at least 20 kt sustained or 25 kt gust.' : ''}${caution ? ' Low reported visibility/ceiling or adverse phenomena; review the METAR.' : ''} Real-world report; MSFS may differ.` };
}
export interface DestinationTheme { scene: 'coast' | 'bay' | 'island' | 'mountains' | 'river'; name: string; sky: string; ridge: string; water: string }
const themes: Record<string, DestinationTheme> = {
  PADQ: { scene: 'coast', name: 'Kodiak island coast', sky: '#b5c4b3', ridge: '#466958', water: '#648c89' },
  PALB: { scene: 'bay', name: 'Larsen Bay coastal region', sky: '#d5c5a9', ridge: '#69775c', water: '#698d87' },
  PAKH: { scene: 'island', name: 'Akhiok island region', sky: '#bac9c5', ridge: '#657d72', water: '#527d86' },
  PAHO: { scene: 'mountains', name: 'Homer and Kachemak Bay region', sky: '#c9ced0', ridge: '#657e8b', water: '#7e9b9f' },
  PAEN: { scene: 'river', name: 'Kenai river country', sky: '#d7ceb8', ridge: '#536e58', water: '#7faaa3' },
};
export function destinationTheme(airport: string): DestinationTheme { return themes[airport] ?? { scene: 'coast', name: 'Alaska aviation landscape', sky: '#c5c8b4', ridge: '#617661', water: '#688d8c' }; }
