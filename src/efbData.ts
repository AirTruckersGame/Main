export const FAA_DTPP = 'https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/';
export const FAA_IFR = 'https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/ifr/';
export const FAA_VFR = 'https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/vfr/';
export function airportId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Z0-9]{3,4}$/.test(value.trim().toUpperCase())) throw new Error('Use an exact 3–4 character airport ID.');
  return value.trim().toUpperCase();
}
export type WeatherKind = 'metar' | 'taf';
export interface WeatherReport { status: 'available' | 'missing' | 'unavailable'; airport: string; kind: WeatherKind; raw?: string; reportTime?: string; decoded?: string[]; retrievedAt: string; message?: string; }
export function weatherLabel(status: WeatherReport['status']): string { return status === 'missing' ? 'No Report' : status === 'unavailable' ? 'Data Unavailable' : 'Report available'; }
export type ChartType = 'IAP' | 'APD' | 'DP' | 'STAR';
export interface Chart { airport: string; title: string; type: ChartType; cycle: string; url: string; effectiveFrom: string; effectiveTo: string; metadataUrl: string; }
export interface ChartCatalog { airport: string; status: 'current' | 'outdated' | 'unavailable'; charts: Chart[]; retrievedAt: string; message?: string; cycle?: string; effectiveFrom?: string; effectiveTo?: string; }
export interface PinnedApproach { flightId: string; chart: Chart; }
export function validChartUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^https:\/\/aeronav\.faa\.gov\/d-tpp\/\d{4}\/[a-zA-Z0-9_-]+\.pdf$/i.test(value) && new URL(value).hostname === 'aeronav.faa.gov';
}
export function validChart(value: Chart): boolean {
  if (!value || !validChartUrl(value.url) || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 300 || !['IAP', 'APD', 'DP', 'STAR'].includes(value.type) || typeof value.airport !== 'string' || !/^[A-Z0-9]{3,4}$/.test(value.airport) || !/^\d{4}$/.test(value.cycle)) return false;
  return value.url.split('/')[4] === value.cycle && value.metadataUrl === `https://aeronav.faa.gov/d-tpp/${value.cycle}/xml_data/d-tpp_Metafile.xml` && Number.isFinite(Date.parse(value.effectiveFrom)) && Date.parse(value.effectiveTo) > Date.parse(value.effectiveFrom);
}
export function chartCurrent(chart: Chart, now = Date.now()): boolean { return validChart(chart) && Date.parse(chart.effectiveFrom) <= now && now < Date.parse(chart.effectiveTo); }
export function pdfEndpoint(chart: Chart): string {
  if (!validChart(chart)) throw new Error('Invalid FAA chart link.');
  return `/api/efb?action=pdf&airport=${encodeURIComponent(chart.airport)}&url=${encodeURIComponent(chart.url)}`;
}
