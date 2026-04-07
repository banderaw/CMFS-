import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    // Increase chunk size warning limit (we reduce via lazy loading instead)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Manual chunking to split vendor dependencies
        manualChunks: (id) => {
          // Split react ecosystem into vendor chunk
          if (id.includes('node_modules')) {
            if (id.includes('react')) {
              return 'react-vendor';
            }
            // Split larger vendor libraries
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          }
        }
      }
    }
  }
})
