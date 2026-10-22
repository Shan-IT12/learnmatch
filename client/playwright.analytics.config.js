import { defineConfig } from '@playwright/test'
export default defineConfig({
  outputDir: '../.local-backups/analytics-test-results',
  testDir: './src/pages/admin',
  testMatch: 'AdminAnalytics.browser.spec.js',
  use: { channel: 'msedge', headless: true },
  webServer: {
    command: 'npm.cmd run dev -- --host 127.0.0.1 --port 5179 --strictPort',
    url: 'http://127.0.0.1:5179',
    reuseExistingServer: true,
    env: { VITE_API_URL: 'http://127.0.0.1:5179' },
  },
})

