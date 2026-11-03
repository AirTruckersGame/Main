import { usePublicationClock } from './usePublicationClock';
import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { FAA_DTPP, chartCurrent, pdfEndpoint, validChart, type Chart } from './efbData';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
export function ChartViewer({ chart }: { chart: Chart }) {
  const publicationTime = usePublicationClock(chart.effectiveFrom, chart.effectiveTo);
  const container = useRef<HTMLDivElement>(null), scroll = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [zoom, setZoom] = useState(1), [page, setPage] = useState(1), [width, setWidth] = useState(600), [ratio, setRatio] = useState(1.4), [expanded, setExpanded] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>()), lastDistance = useRef<number | null>(null), drag = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    let cancelled = false; let task: { destroy: () => Promise<void> } | undefined;
    setDocument(null); setError(''); setLoading(true); setPage(1); setZoom(1);
    if (!validChart(chart)) { setError('Invalid FAA chart link.'); setLoading(false); return; }
    void import('pdfjs-dist/legacy/build/pdf.mjs').then(pdf => {
      if (cancelled) return;
      pdf.GlobalWorkerOptions.workerSrc = workerUrl;
      const loadingTask = pdf.getDocument({ url: pdfEndpoint(chart), disableRange: true, disableStream: true, isEvalSupported: false }); task = loadingTask;
      return loadingTask.promise.then(doc => { if (!cancelled) setDocument(doc); });
    }).catch(() => { if (!cancelled) { setError('Chart rendering is unavailable. Use the official FAA link below.'); setLoading(false); } });
    return () => { cancelled = true; void task?.destroy().catch(() => {}); };
  }, [chart.url]);
  useEffect(() => {
    if (!scroll.current) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(180, Math.min(1400, entries[0].contentRect.width - 24))));
    observer.observe(scroll.current); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!document) return;
    let cancelled = false; let render: { cancel: () => void } | undefined;
    const timeout = setTimeout(() => { void document.getPage(page).then(async pdfPage => {
      if (cancelled) return;
      const base = pdfPage.getViewport({ scale: 1 }); setRatio(base.height / base.width);
      const cssWidth = width * zoom, cssHeight = cssWidth * base.height / base.width;
      // Limit canvas memory on iPad; rendering remains independent of CSS zoom size.
      const density = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(12_000_000 / (cssWidth * cssHeight)));
      const viewport = pdfPage.getViewport({ scale: cssWidth / base.width * density });
      const temporary = window.document.createElement('canvas'); temporary.width = Math.ceil(viewport.width); temporary.height = Math.ceil(viewport.height);
      const context = temporary.getContext('2d'); if (!context) throw new Error('Canvas unavailable');
      const rendering = pdfPage.render({ canvasContext: context, viewport }); render = rendering;
      await rendering.promise;
      if (cancelled || !canvas.current) return;
      canvas.current.width = temporary.width; canvas.current.height = temporary.height;
      const output = canvas.current.getContext('2d'); if (!output) throw new Error('Canvas unavailable'); output.drawImage(temporary, 0, 0); setLoading(false);
      temporary.width = 0; temporary.height = 0;
    }).catch(() => { if (!cancelled) { setLoading(false); setError('The PDF could not be rendered. Open the official FAA PDF below.'); } }); }, 100);
    return () => { cancelled = true; clearTimeout(timeout); render?.cancel(); };
  }, [document, page, width, zoom]);
  useEffect(() => { if (!expanded) return; const listener = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); }; window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener); }, [expanded]);
  function changeZoom(next: number) { setZoom(Math.max(1, Math.min(4, next))); }
  function fullscreen() { setExpanded(!expanded); /* CSS full-screen also works where iPad Safari lacks element Fullscreen API. */ }
  return <section className={`chart-viewer card${expanded ? ' expanded' : ''}`} ref={container} aria-label="FAA chart viewer">
    <div className="viewer-heading"><div><strong>{chart.title}</strong><small>FAA d-TPP · {chart.airport} · Cycle {chart.cycle}</small></div><button className="secondary" onClick={fullscreen}>{expanded ? 'Exit full screen' : 'Full screen'}</button></div>
    <p className={chartCurrent(chart, publicationTime) ? 'chart-dates' : 'alert'}>{chartCurrent(chart, publicationTime) ? 'Verified publication interval' : 'Outdated or not yet effective — not current'}: {chart.effectiveFrom} to {chart.effectiveTo} (UTC). Simulator navigation data may differ.</p>
    <div className="viewer-toolbar"><button aria-label="Zoom out" onClick={() => changeZoom(zoom - 0.25)} disabled={zoom <= 1}>−</button><span>{Math.round(zoom * 100)}%</span><button aria-label="Zoom in" onClick={() => changeZoom(zoom + 0.25)} disabled={zoom >= 4}>+</button><button onClick={() => { changeZoom(1); if (scroll.current) { scroll.current.scrollLeft = 0; scroll.current.scrollTop = 0; } }}>Fit to width</button><label>Page <select aria-label="PDF page" value={page} onChange={e => setPage(Number(e.target.value))}>{Array.from({ length: document?.numPages ?? 1 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label></div>
    {loading && !error && <p role="status" className="muted viewer-message">Loading FAA PDF…</p>}{error && <p role="alert" className="alert">{error}</p>}
    <div className="plate-scroll" ref={scroll} onPointerDown={e => { if (e.pointerType === 'mouse' && e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); drag.current = { x: e.clientX, y: e.clientY }; if (pointers.current.size === 2) { const points = [...pointers.current.values()]; lastDistance.current = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y); } }} onPointerMove={e => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const points = [...pointers.current.values()];
      if (points.length >= 2) { const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y); if (lastDistance.current && lastDistance.current > 0) { const multiplier = distance / lastDistance.current; setZoom(value => Math.max(1, Math.min(4, value * multiplier))); } lastDistance.current = distance; drag.current = null; }
      else if (drag.current && scroll.current) { scroll.current.scrollLeft -= e.clientX - drag.current.x; scroll.current.scrollTop -= e.clientY - drag.current.y; drag.current = { x: e.clientX, y: e.clientY }; }
    }} onPointerUp={e => { pointers.current.delete(e.pointerId); lastDistance.current = null; drag.current = null; }} onPointerCancel={e => { pointers.current.delete(e.pointerId); lastDistance.current = null; drag.current = null; }}>
      {!error && <canvas ref={canvas} aria-label={`${chart.title} PDF page ${page}`} role="img" style={{ width: width * zoom, height: width * zoom * ratio }}/>}
    </div>
    <div className="viewer-footer">Pinch or use zoom buttons; drag to pan. <a href={validChart(chart) ? chart.url : FAA_DTPP} target="_blank" rel="noopener noreferrer">Open / download official FAA PDF ↗</a></div>
  </section>;
}
