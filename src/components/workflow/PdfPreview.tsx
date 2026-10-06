import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

/** Render one page at a time, fitted to both dimensions of the available space. */
export default function PdfPreview({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [renderZoom, setRenderZoom] = useState(1);
  const [bitmapZoom, setBitmapZoom] = useState(1);
  const [isGesturing, setIsGesturing] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const clampZoom = (zoom: number) => Math.max(1, Math.min(4, zoom));
  const changeZoom = (zoom: number) => {
    setView((current) => ({ ...current, zoom: clampZoom(zoom), ...(zoom <= 1 ? { x: 0, y: 0 } : {}) }));
  };

  // Keep gesture frames cheap; sharpen the bitmap only once zoom has settled.
  useEffect(() => {
    if (isGesturing) return;
    const timer = window.setTimeout(() => setRenderZoom(view.zoom), 180);
    return () => window.clearTimeout(timer);
  }, [view.zoom, isGesturing]);

  useEffect(() => {
    setView({ zoom: 1, x: 0, y: 0 });
    pointers.current.clear();
  }, [url, page, size]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const maxX = Math.max(0, (canvas.offsetWidth * view.zoom / bitmapZoom - size.width) / 2);
    const maxY = Math.max(0, (canvas.offsetHeight * view.zoom / bitmapZoom - size.height) / 2);
    const x = Math.max(-maxX, Math.min(maxX, view.x));
    const y = Math.max(-maxY, Math.min(maxY, view.y));
    if (x !== view.x || y !== view.y) setView((current) => ({ ...current, x, y }));
  }, [view, size, bitmapZoom]);

  useEffect(() => {
    let cancelled = false;
    setDocument(null);
    setPage(1);
    setError(null);
    const task = getDocument({ url });
    task.promise.then((pdf) => {
      if (!cancelled) setDocument(pdf);
    }).catch((err: Error) => {
      if (!cancelled) setError(err.message);
    });
    return () => { cancelled = true; void task.destroy(); };
  }, [url]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!document || !size.width || !size.height) return;
    let cancelled = false;
    let renderTask: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    const render = async () => {
      try {
        const pdfPage = await document.getPage(page);
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        const viewport = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min(size.width / viewport.width, size.height / viewport.height);
        const fitted = pdfPage.getViewport({ scale });
        // Render at the final display resolution, including zoom. Passing a
        // fitted viewport with only a transform can downsample PDF images early.
        const desiredRatio = Math.max(2, window.devicePixelRatio || 1) * renderZoom;
        // Bound bitmap memory on high-density phones while preserving detail.
        const pixelRatio = Math.min(desiredRatio, Math.sqrt(16_000_000 / (fitted.width * fitted.height)));
        const renderViewport = pdfPage.getViewport({ scale: scale * pixelRatio });
        // Render offscreen so the visible page never clears or partially redraws.
        const buffer = window.document.createElement('canvas');
        buffer.width = Math.ceil(fitted.width * pixelRatio);
        buffer.height = Math.ceil(fitted.height * pixelRatio);
        renderTask = pdfPage.render({
          canvas: buffer,
          viewport: renderViewport,
        });
        await renderTask.promise;
        if (cancelled) return;
        canvas.width = buffer.width;
        canvas.height = buffer.height;
        canvas.style.width = `${fitted.width * renderZoom}px`;
        canvas.style.height = `${fitted.height * renderZoom}px`;
        canvas.getContext('2d')?.drawImage(buffer, 0, 0);
        setBitmapZoom(renderZoom);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to display PDF.');
      }
    };
    void render();
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [document, page, size, renderZoom]);

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
      <div
        ref={containerRef}
        data-vaul-no-drag
        className="flex-1 min-h-0 min-w-0 overflow-hidden flex items-center justify-center"
        style={{ touchAction: 'none', overscrollBehavior: 'none' }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          setIsGesturing(true);
        }}
        onPointerMove={(event) => {
          if (!pointers.current.has(event.pointerId)) return;
          const before = [...pointers.current.values()];
          const previous = pointers.current.get(event.pointerId)!;
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          const after = [...pointers.current.values()];
          if (before.length === 2) {
            const distance = (points: typeof before) => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
            const oldDistance = distance(before);
            if (!oldDistance) return;
            setView((current) => {
              const zoom = clampZoom(current.zoom * distance(after) / oldDistance);
              const rect = containerRef.current!.getBoundingClientRect();
              const oldX = (before[0].x + before[1].x) / 2 - rect.left - rect.width / 2;
              const oldY = (before[0].y + before[1].y) / 2 - rect.top - rect.height / 2;
              const newX = (after[0].x + after[1].x) / 2 - rect.left - rect.width / 2;
              const newY = (after[0].y + after[1].y) / 2 - rect.top - rect.height / 2;
              const ratio = zoom / current.zoom;
              return { zoom, x: zoom === 1 ? 0 : newX - (oldX - current.x) * ratio,
                y: zoom === 1 ? 0 : newY - (oldY - current.y) * ratio };
            });
          } else if (before.length === 1) {
            setView((current) => current.zoom === 1 ? current : {
              ...current, x: current.x + event.clientX - previous.x, y: current.y + event.clientY - previous.y,
            });
          }
        }}
        onPointerUp={(event) => { pointers.current.delete(event.pointerId); setIsGesturing(pointers.current.size > 0); }}
        onPointerCancel={(event) => { pointers.current.delete(event.pointerId); setIsGesturing(pointers.current.size > 0); }}
        onLostPointerCapture={(event) => { pointers.current.delete(event.pointerId); setIsGesturing(pointers.current.size > 0); }}
      >
        {error ? <p role="alert" className="text-red-600 p-4">{error}</p> : (
          <>
            {!document && <span role="status" className="text-gray-500">Loading PDF...</span>}
            <canvas ref={canvasRef} aria-label={`PDF page ${page}`} className={document ? 'block shrink-0' : 'hidden'}
              style={{
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom / bitmapZoom})`,
                willChange: isGesturing ? 'transform' : 'auto',
                transition: isGesturing || view.zoom === bitmapZoom ? 'none' : 'transform 160ms ease-out',
              }} />
          </>
        )}
      </div>
      {document && (
        <div className="flex items-center justify-center gap-3 py-2 shrink-0 text-[13px] bg-white" data-vaul-no-drag>
          <button type="button" aria-label="Zoom out" disabled={view.zoom <= 1} onClick={() => changeZoom(view.zoom - 0.25)} className="h-10 w-10 text-xl text-blue-600 disabled:opacity-40">−</button>
          <span className="min-w-12 text-center">{Math.round(view.zoom * 100)}%</span>
          <button type="button" aria-label="Zoom in" disabled={view.zoom >= 4} onClick={() => changeZoom(view.zoom + 0.25)} className="h-10 w-10 text-xl text-blue-600 disabled:opacity-40">+</button>
          <button type="button" onClick={() => setView({ zoom: 1, x: 0, y: 0 })} className="h-10 px-3 text-blue-600">Fit page</button>
        </div>
      )}
      {document && document.numPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-2 shrink-0 text-[13px]">
          <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} className="text-blue-600 disabled:opacity-40">Previous</button>
          <span>{page} / {document.numPages}</span>
          <button type="button" disabled={page === document.numPages} onClick={() => setPage(page + 1)} className="text-blue-600 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}
