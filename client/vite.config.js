import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { SOURCE_CHECK_PROXY_TIMEOUT_MS } from '../shared/sourceCheckTiming.js'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/admin/course-sources': {
        target: 'http://127.0.0.1:5000',
        timeout: SOURCE_CHECK_PROXY_TIMEOUT_MS,
        proxyTimeout: SOURCE_CHECK_PROXY_TIMEOUT_MS,
      },
    },
  },
})
