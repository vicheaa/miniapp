import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_BASE_URL || env.VITE_DEV_API_BASE_URL;

  return {
    plugins: [react(), tailwindcss()],
    base: './',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: apiTarget
        ? Object.fromEntries(['/api', '/services', '/files', '/storage'].map((prefix) => [
            prefix,
            { target: apiTarget, changeOrigin: true },
          ]))
        : undefined,
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          },
        },
      },
    },
  };
});
