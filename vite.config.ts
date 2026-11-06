import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { appConfig } from './src/config.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const proxyTarget = env.VITE_DEV_PROXY_TARGET;

  return {
    plugins: [
      react(),
      tailwindcss(),
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
        ? Object.fromEntries(['/api', '/services', '/files', '/storage'].map((prefix) => [
            prefix, { target: proxyTarget, changeOrigin: true },
          ]))
        : undefined,
    },
    build: { outDir: 'dist' },
  };
});
