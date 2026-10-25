import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './src/pages', testMatch: 'SchoolLocator.browser.spec.js',
  outputDir: '../.local-backups/locator/browser-results', workers: 1,
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  use: { channel: 'msedge', headless: true, baseURL: 'http://127.0.0.1:5183' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5183 --strictPort',
    url: 'http://127.0.0.1:5183', reuseExistingServer: true,
    env: { VITE_API_URL: 'http://127.0.0.1:5183' },
  },
})
