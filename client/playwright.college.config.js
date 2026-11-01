import settingsConfig from './playwright.settings.config.js'

export default {
  ...settingsConfig,
  testMatch: 'CollegeCompletion.browser.spec.js',
  outputDir: '../.local-backups/college-test-results',
}
