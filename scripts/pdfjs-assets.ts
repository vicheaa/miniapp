import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { transformWithOxc, type Plugin } from 'vite';

/** Keep PDF.js resources in the ZIP; the miniapp cannot rely on a CDN. */
export function pdfjsAssets(): Plugin {
  const require = createRequire(import.meta.url);
  const root = path.dirname(require.resolve('pdfjs-dist/package.json'));
  const files = new Map<string, string>();
  let target: string | string[] = 'es2018';
  for (const directory of ['cmaps', 'standard_fonts', 'wasm']) {
    for (const filename of readdirSync(path.join(root, directory))) {
      files.set(`pdfjs/${directory}/${filename}`, path.join(root, directory, filename));
    }
  }
  return {
    name: 'miniapp-pdfjs-assets',
    configResolved(config) {
      if (config.build.target) target = config.build.target;
    },
    async generateBundle() {
      for (const [fileName, source] of files) {
        // Decoder fallback modules are JavaScript too, so preserve the same
        // browser syntax target as the PDF worker and app.
        const data = fileName.endsWith('.js')
          ? (await transformWithOxc(readFileSync(source, 'utf8'), source, { target })).code
          : readFileSync(source);
        this.emitFile({ type: 'asset', fileName, source: data });
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const filename = files.get((req.url || '').split('?')[0].replace(/^\//, ''));
        if (!filename) return next();
        res.setHeader('Content-Type', filename.endsWith('.wasm') ? 'application/wasm'
          : filename.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
        res.end(readFileSync(filename));
      });
    },
  };
}
