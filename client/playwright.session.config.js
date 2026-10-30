import { defineConfig } from '@playwright/test'

export default defineConfig({
  outputDir: '../.local-backups/session-test-results',
  testDir: './src/pages',
  testMatch: 'StudentSession.browser.spec.js',
  workers: 1,
  use: { channel: 'msedge', headless: true, baseURL: 'http://127.0.0.1:5183' },
  webServer: {
    command: 'npm.cmd run dev -- --host 127.0.0.1 --port 5183 --strictPort',
    url: 'http://127.0.0.1:5183',
    reuseExistingServer: true,
    env: { VITE_API_URL: 'http://127.0.0.1:5183' },
  },
})
