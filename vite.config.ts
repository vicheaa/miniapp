import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { appConfig } from './src/config.ts';

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const proxyTarget = env.VITE_DEV_PROXY_TARGET;

  return {
    // A configured development proxy owns API routing; browser calls stay same-origin.
    define: command === 'serve' && proxyTarget
      ? { 'import.meta.env.VITE_API_ORIGIN': JSON.stringify('') }
      : undefined,
    plugins: [
      react(),
      // Let Vite optimize CSS for the device target; Tailwind's optimizer assumes Chrome 111.
      tailwindcss({ optimize: false }),
      {
        name: 'miniapp-title',
        transformIndexHtml: (html) => html.replace(
          '__MINIAPP_TITLE__',
          appConfig.title.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
        ),
      },
    ],
    base: './',
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      proxy: proxyTarget
        ? Object.fromEntries(['/api', '/services', '/files', '/storage', '/central', '/media'].map((prefix) => [
            prefix, { target: proxyTarget, changeOrigin: true },
          ]))
        : undefined,
    },
    // Sunmi V3 ships WebView 101, which needs the 100vh fallback before 100dvh.
    build: { outDir: 'dist', cssTarget: 'chrome101' },
  };
});
