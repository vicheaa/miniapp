import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, X, Loader2 } from 'lucide-react';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PdfPreviewModalProps {
  url: string;
  title: string;
  onClose: () => void;
}

export default function PdfPreviewModal({ url, title, onClose }: PdfPreviewModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState<boolean>(false);
  const renderTaskRef = useRef<any>(null);

  // Load PDF document
  useEffect(() => {
    setLoading(true);
    setError(null);
    setPageNum(1);

    const loadingTask = pdfjs.getDocument({
      url,
      cMapPacked: true,
    });

    loadingTask.promise.then(
      (pdf) => {
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setLoading(false);
      },
      (err) => {
        console.error('[PdfPreviewModal] Error loading PDF:', err);
        setError(`Failed to load PDF: ${err.message || err}`);
        setLoading(false);
      }
    );

    return () => {
      loadingTask.destroy();
    };
  }, [url]);

  // Render Page when pageNum or scale or pdfDoc changes
  useEffect(() => {
    if (!pdfDoc) return;

    let isCurrent = true;
    setRendering(true);

    pdfDoc.getPage(pageNum).then((page) => {
      if (!isCurrent || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      // Cancel previous render task if active
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const viewport = page.getViewport({ scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport,
        canvas,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;

      renderTask.promise.then(
        () => {
          if (isCurrent) {
            setRendering(false);
            renderTaskRef.current = null;
          }
        },
        (err) => {
          if (err.name !== 'RenderingCancelledException' && isCurrent) {
            console.error('[PdfPreviewModal] Render error:', err);
            setRendering(false);
          }
        }
      );
    });

    return () => {
      isCurrent = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, pageNum, scale]);

  const handlePrevPage = () => {
    if (pageNum > 1) {
      setPageNum((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (pageNum < numPages) {
      setPageNum((prev) => prev + 1);
    }
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 2.5));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setScale(1.0);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 backdrop-blur-md">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 text-white shadow-md">
        <div className="flex flex-col min-w-0 animate-fade-in">
          <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Document Preview</span>
          <h2 className="text-sm font-bold truncate text-slate-100">{title}</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-slate-700 transition-colors text-slate-300 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      {/* Toolbar Controls */}
      {!loading && !error && (
        <div className="flex flex-wrap items-center justify-center gap-4 py-2 px-4 bg-slate-800/60 border-b border-slate-700/60 text-slate-200">
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={pageNum <= 1}
              className="p-1 rounded hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-[13px] font-medium min-w-[70px] text-center select-none">
              {pageNum} / {numPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={pageNum >= numPages}
              className="p-1 rounded hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="w-[1px] h-4 bg-slate-700 hidden sm:block" />

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              className="p-1 rounded hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-transparent"
              title="Zoom Out"
            >
              <ZoomOut size={18} />
            </button>
            <span className="text-[13px] font-medium min-w-[45px] text-center select-none">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={scale >= 2.5}
              className="p-1 rounded hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-transparent"
              title="Zoom In"
            >
              <ZoomIn size={18} />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
              title="Reset Zoom"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Main Canvas Area */}
      <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-slate-950/40">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
            <p className="text-sm font-medium">Loading document page data...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center p-6 text-center max-w-md bg-slate-800/80 border border-slate-700 rounded-xl mt-10 text-rose-400 shadow-xl">
            <p className="text-sm font-semibold mb-2">Error Displaying PDF</p>
            <p className="text-xs opacity-80 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg text-xs hover:bg-slate-600 font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="relative shadow-2xl border border-slate-800/40 rounded-sm bg-white overflow-hidden">
            {rendering && (
              <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            )}
            <canvas ref={canvasRef} className="block max-w-full animate-fade-in" />
          </div>
        )}
      </div>
    </div>
  );
}
