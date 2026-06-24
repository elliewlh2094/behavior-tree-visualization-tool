import { test, expect } from '@playwright/test';

// Theme ownership is split by route (v1.11):
//   - Landing (#/) follows the OS/browser only — no user control, the saved
//     editor preference is ignored.
//   - Editor (#/editor) defaults to following the OS but can be overridden in
//     Settings, and that override persists.
// Each test runs in a fresh context, so localStorage starts empty.
test.describe('Theme ownership by route', () => {
  test('editor defaults to following the OS theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('#/editor');
    // No saved preference → default 'system' → OS dark → .dark applied.
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('landing follows the OS theme and ignores the saved editor preference', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });

    // Save a Dark preference through the editor.
    await page.goto('#/editor');
    await page.getByRole('tab', { name: /settings/i }).click();
    await page.getByRole('radio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Landing must NOT honor that saved pref — it follows the OS (light here).
    await page.goto('#/');
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // Flipping the OS to dark flips the landing live (matchMedia subscription).
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('editor keeps an explicit Light override even when the OS is dark', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('#/editor');
    await page.getByRole('tab', { name: /settings/i }).click();
    await page.getByRole('radio', { name: 'Light' }).click();
    // Explicit Light wins over the dark OS.
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });
});
