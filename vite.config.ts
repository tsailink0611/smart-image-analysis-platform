import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://h6util56iwzeyadx6kbjyuakbi0zuucm.lambda-url.us-east-1.on.aws',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          recharts: ['recharts'],
          utils: ['axios', 'papaparse']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'recharts', 'axios', 'papaparse']
  }
})
