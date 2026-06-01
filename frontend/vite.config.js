import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ['framer-motion'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
          if (id.includes('/recharts/') || id.includes('/d3-')) return 'charts-vendor';
          if (id.includes('/framer-motion/')) return 'motion-vendor';
          if (id.includes('/@radix-ui/')) return 'ui-vendor';
          if (id.includes('/lucide-react/')) return 'icons-vendor';
          if (id.includes('/oidc-client-ts/') || id.includes('/i18next') || id.includes('/axios/')) return 'app-vendor';
          return undefined;
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
