import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Vitest configuration. Kept separate from vite.config.js so the dev-server
// proxy/react plugin don't affect the (jsdom) test environment.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
})
