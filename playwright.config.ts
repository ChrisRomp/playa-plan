import { defineConfig, devices } from '@playwright/test';

const REUSE_DB = process.env.E2E_REUSE_DB === 'true';
const TAGS = process.env.E2E_TAGS;

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Tests are namespaced per-run, so two workers are safe in CI. */
  workers: process.env.CI ? 2 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI
    ? [
        ['html'],
        ['github'],
        ['json', { outputFile: 'playwright-report/results.json' }],
      ]
    : 'html',
  /* Tag-driven filter: `E2E_TAGS=@auth npm run test:e2e` */
  grep: TAGS ? new RegExp(TAGS) : undefined,
  /* Global timeout for each test */
  timeout: 30 * 1000,
  /* Expect timeout for assertions */
  expect: {
    timeout: 10 * 1000,
  },
  globalSetup: './tests/helpers/globalSetup.ts',
  globalTeardown: './tests/helpers/globalTeardown.ts',
  /* Shared settings for all the tests below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:5173',

    /* Run headless in CI, headed locally for debugging */
    headless: !!process.env.CI,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video recording on retry */
    video: 'retain-on-failure',

    /* Action timeout */
    actionTimeout: 10 * 1000,

    /* Navigation timeout */
    navigationTimeout: 15 * 1000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        // Additional CI-friendly Chrome options
        launchOptions: process.env.CI
          ? {
              args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
              ],
            }
          : {},
      },
    },

    // Uncomment for cross-browser testing in CI
    // {
    //   name: 'firefox',
    //   dependencies: ['setup'],
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   dependencies: ['setup'],
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /* Run your local dev server before starting the tests.
   * In CI, services are managed by scripts/test-e2e.sh.
   * In local "dev" mode (E2E_REUSE_DB=true) we assume the stack is already up. */
  webServer:
    process.env.CI || REUSE_DB
      ? undefined
      : {
          command: 'npm run dev',
          url: 'http://localhost:5173',
          reuseExistingServer: true,
          timeout: 120 * 1000, // 2 minutes to start
          stdout: 'ignore',
          stderr: 'pipe',
        },
});