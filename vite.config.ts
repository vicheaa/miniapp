import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_DEV_API_BASE_URL || 'http://10.0.12.229:8282';

  return {
    plugins: [react(), tailwindcss()],
    // IMPORTANT: Use relative paths so the app works when served by the
    // Flutter LocalServerService (which serves from the device filesystem)
    base: './',
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
      },
    },
    build: {
      outDir: 'dist',
      // Generate a single JS bundle for simpler deployment
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
  };
});
