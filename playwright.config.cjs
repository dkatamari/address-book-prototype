const { defineConfig } = require('@playwright/test')
module.exports = defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3002',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1512, height: 1100 },
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:3002',
    reuseExistingServer: true,
  },
})
