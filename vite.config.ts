import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Mini App is served from the root of its own host
// (https://app<app_id>.tgcloud.ai/), so base "/" is correct.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  server: {
    port: 5173,
  },
});
