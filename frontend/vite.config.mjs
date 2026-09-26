import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  // The React dev server runs on :5173 while the backend listens on :3000.
  // Every /api request is proxied so the frontend can use same-origin URLs
  // (see src/services/authService.js and src/services/examService.js).
  // Override the backend location with API_PROXY_TARGET when it runs on
  // another port, e.g. API_PROXY_TARGET=http://localhost:3001 npm run dev
  server: {
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  
  },
)



