import { defineConfig } from '@playwright/test'

export default defineConfig({
  outputDir: '../.local-backups/public-test-results',
  testDir: './src/pages',
  testMatch: 'PublicInformation.browser.spec.js',
  workers: 1,
  use: { channel: 'msedge', headless: true, baseURL: 'http://127.0.0.1:5181' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5181 --strictPort',
    url: 'http://127.0.0.1:5181',
    reuseExistingServer: true,
    env: { VITE_API_URL: 'http://127.0.0.1:5181' },
  },
})
