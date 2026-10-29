import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Local dev: forward /api to a deployed instance (MLB data is fetched server-side there).
    proxy: process.env.FULLCOUNT_API
      ? { '/api': { target: process.env.FULLCOUNT_API, changeOrigin: true } }
      : undefined,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
