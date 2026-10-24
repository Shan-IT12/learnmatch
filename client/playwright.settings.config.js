import { defineConfig } from '@playwright/test'

export default defineConfig({
  outputDir: '../.local-backups/settings-test-results',
  testDir: './src/pages',
  testMatch: 'StudentSettings.browser.spec.js',
  use: { channel: 'msedge', headless: true, baseURL: 'http://127.0.0.1:5180' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5180 --strictPort',
    url: 'http://127.0.0.1:5180',
    reuseExistingServer: true,
    env: { VITE_API_URL: 'http://127.0.0.1:5180' },
  },
})
