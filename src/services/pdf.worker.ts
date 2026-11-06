import '../lib/promise-with-resolvers';
// PDF.js 6 serializes font data with this API even in its legacy worker.
// Workers have separate globals, so the app's core-js import cannot supply it.
import 'core-js/actual/array-buffer/transfer-to-fixed-length';
import 'pdfjs-dist/legacy/build/pdf.worker.mjs';
