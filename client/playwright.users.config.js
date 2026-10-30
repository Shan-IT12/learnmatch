import { defineConfig } from '@playwright/test'

export default defineConfig({
  outputDir: '../.local-backups/users-test-results',
  testDir: './src/pages/admin',
  testMatch: 'AdminUsers.browser.spec.js',
  workers: 1,
  use: { channel: 'msedge', headless: true, baseURL: 'http://127.0.0.1:5185' },
  webServer: {
    command: 'npm.cmd run dev -- --host 127.0.0.1 --port 5185 --strictPort',
    url: 'http://127.0.0.1:5185',
    reuseExistingServer: true,
    env: { VITE_API_URL: 'http://127.0.0.1:5185' },
  },
})
