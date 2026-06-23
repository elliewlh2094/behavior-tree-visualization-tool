import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'html',
  use: {
    // preview serves under the deploy subpath base (vite.config isPreview branch),
    // so the baseURL carries that path; specs use relative goto('#/editor') etc.
    baseURL: 'http://localhost:4173/behavior-tree-visualization-tool/',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
