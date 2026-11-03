// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChartViewer } from './ChartViewer';
import type { Chart } from './efbData';
// Synthetic metadata fixture. Not an actual FAA procedure or live chart link.
const chart: Chart = { airport: 'PADQ', title: 'TEST APPROACH - FIXTURE ONLY', cycle: '2611', type: 'IAP', url: 'https://aeronav.faa.gov/d-tpp/2611/TESTONLY.PDF', metadataUrl: 'https://aeronav.faa.gov/d-tpp/2611/xml_data/d-tpp_Metafile.xml', effectiveFrom: '2026-10-29T09:01:00Z', effectiveTo: '2026-11-26T09:01:00Z' };
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({ GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.reject(new Error('PDF fetch failed')), destroy: async () => {} }) }));
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('integrated chart viewer fallbacks', () => {
  it('keeps an official open/download link when PDF loading or rendering fails', async () => {
    render(<ChartViewer chart={chart}/>);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Chart rendering is unavailable'));
    expect(screen.getByRole('link', { name: /Open \/ download official FAA PDF/ }).getAttribute('href')).toBe(chart.url);
    expect(screen.queryByRole('img')).toBeNull();
  });
  it('provides touch-sized controls, fit-to-width, CSS full-screen exit and Escape', () => {
    render(<ChartViewer chart={chart}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' })); expect(screen.getByText('125%')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fit to width' })); expect(screen.getByText('100%')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' })); expect(screen.getByRole('button', { name: 'Exit full screen' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' }); expect(screen.getByRole('button', { name: 'Full screen' })).toBeTruthy();
  });
  it('changes a displayed plate to outdated at its real-world publication boundary', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-26T09:00:59Z'));
    render(<ChartViewer chart={chart}/>);
    expect(screen.getByText(/Verified publication interval/)).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(1002); });
    expect(screen.getByText(/Outdated or not yet effective/)).toBeTruthy();
  });
  it('never makes unsafe chart URLs clickable and clearly identifies outdated data', () => {
    render(<ChartViewer chart={{ ...chart, effectiveTo: '2026-10-30T09:01:00Z', url: 'javascript:alert(1)' }}/>);
    expect(screen.getByText(/Outdated or not yet effective/)).toBeTruthy();
    expect(screen.getByRole('alert', { name: '' }).textContent).toContain('Invalid FAA chart link');
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/');
  });
});
