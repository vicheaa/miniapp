import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { pdfjsAssets } from './scripts/pdfjs-assets';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget =
    env.VITE_API_BASE_URL ||
    env.VITE_DEV_API_BASE_URL ||
    'http://oneiis.vital.com.kh';

  return {
    plugins: [react(), pdfjsAssets()],
    base: './',
    // Build the PDF worker with the same syntax target as the application.
    worker: {
      format: 'es',
      rollupOptions: {
        output: {
          // Vite removes worker entry exports. PDF.js also imports this file
          // on the main thread when a WebView cannot create a native worker.
          footer: (chunk) => chunk.facadeModuleId?.endsWith('/services/pdf.worker.ts')
            ? 'const __miniappWorkerHandler = globalThis.pdfjsWorker.WorkerMessageHandler; export { __miniappWorkerHandler as WorkerMessageHandler };'
            : '',
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/services': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        '/files': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: 'dist',
      // Embedded iOS WebViews use the device's Safari engine. In particular,
      // class static blocks must be transformed for iOS versions before 16.4.
      target: ['es2018', 'safari14.5', 'chrome88', 'firefox78'],
      cssTarget: ['safari14.5', 'chrome88', 'firefox78'],
      // Let dynamic imports split naturally; a single forced vendor chunk
      // would pull the PDF renderer back into the startup dependency graph.
    },
  };
});
