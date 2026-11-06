import '../lib/promise-with-resolvers';
import { getDocument as loadDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api';

export { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';

export function getDocument(source: DocumentInitParameters) {
  // Resolve from the entry page, including when the native app hosts the ZIP
  // beneath a path. Never resolve these relative to a blob PDF URL.
  const assets = new URL(`${import.meta.env.BASE_URL}pdfjs/`, window.location.href);
  return loadDocument({
    cMapUrl: new URL('cmaps/', assets).href,
    cMapPacked: true,
    standardFontDataUrl: new URL('standard_fonts/', assets).href,
    wasmUrl: new URL('wasm/', assets).href,
    // Fetch support files on the page so native/local-server worker restrictions
    // don't prevent loading fonts and character maps.
    useWorkerFetch: false,
    // Use the packaged standard fonts instead of device-dependent substitutes.
    useSystemFonts: false,
    // Some Android WebViews accept embedded fonts but paint no text. Drawing
    // glyph outlines avoids the native font loader on those devices.
    disableFontFace: /Android/i.test(navigator.userAgent),
    ...source,
  });
}
