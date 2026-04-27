import { test, expect, type Page } from '@playwright/test';

// Helper: clear persisted prefs + reload + enter editor. Each test starts
// from a deterministic baseline (DEFAULT_PREFERENCES) so persisted state
// from earlier tests can't leak.
async function freshEditor(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: /new tree/i }).click();
  await expect(page.locator('.react-flow__node')).toBeVisible();
}

test.describe('Settings tab', () => {
  test.beforeEach(async ({ page }) => {
    await freshEditor(page);
  });

  test('Sidebar starts on Properties; clicking Settings tab swaps the body', async ({ page }) => {
    // Properties is the default tab — empty state visible.
    await expect(page.getByText(/select a node to edit/i)).toBeVisible();

    await page.getByRole('tab', { name: /settings/i }).click();
    await expect(page.getByText('Node Color')).toBeVisible();
    await expect(page.getByText('Theme')).toBeVisible();
    await expect(page.getByText('Grid Background')).toBeVisible();
    await expect(page.getByText(/select a node to edit/i)).not.toBeVisible();

    await page.getByRole('tab', { name: /properties/i }).click();
    await expect(page.getByText(/select a node to edit/i)).toBeVisible();
    await expect(page.getByText('Node Color')).not.toBeVisible();
  });

  test('Theme → Dark adds .dark class and persists across reload (FOUC script)', async ({ page }) => {
    await page.getByRole('tab', { name: /settings/i }).click();
    await page.getByRole('radio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Reload — the FOUC <script> in index.html should add .dark to <html>
    // synchronously before React mounts. If it fails, useTheme would still
    // catch it after hydration but there'd be a flash; this assertion runs
    // immediately after navigation and would fail if .dark were missing.
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.getByRole('button', { name: /new tree/i }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('Changing a node family recolors the matching nodes on the canvas', async ({ page }) => {
    // Drop a Sequence node so we can observe its background.
    const palette = page.getByRole('list');
    const canvas = page.locator('.react-flow');
    await palette.getByText('Sequence', { exact: true }).dragTo(canvas, {
      targetPosition: { x: 400, y: 200 },
    });
    await expect(page.locator('.react-flow__node')).toHaveCount(2);

    // The BTNode wrapper is the first child div inside .react-flow__node.
    // Default Sequence family is cyan → bg = cyan-100 = #cffafe.
    const sequenceWrapper = page
      .locator('.react-flow__node')
      .filter({ hasText: 'SEQUENCE' })
      .locator('> div')
      .first();
    await expect(sequenceWrapper).toHaveCSS('background-color', 'rgb(207, 250, 254)');

    // Switch Sequence to rose via the picker.
    await page.getByRole('tab', { name: /settings/i }).click();
    await page.getByRole('button', { name: /sequence: cyan/i }).click();
    await page.getByRole('radio', { name: 'Rose' }).click();

    // rose-100 = #ffe4e6 → rgb(255, 228, 230).
    await expect(sequenceWrapper).toHaveCSS('background-color', 'rgb(255, 228, 230)');
  });

  test('Reset to Defaults restores theme and node families', async ({ page }) => {
    await page.getByRole('tab', { name: /settings/i }).click();
    // Customize: rose Sequence + dark theme.
    await page.getByRole('button', { name: /sequence: cyan/i }).click();
    await page.getByRole('radio', { name: 'Rose' }).click();
    await page.getByRole('radio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.getByRole('button', { name: /sequence: rose/i })).toBeVisible();

    // Reset → confirm.
    await page.getByRole('button', { name: /reset to defaults/i }).click();
    await page.getByRole('button', { name: /^yes$/i }).click();

    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await expect(page.getByRole('button', { name: /sequence: cyan/i })).toBeVisible();
  });

  test('Reset confirm: clicking No leaves customizations intact', async ({ page }) => {
    await page.getByRole('tab', { name: /settings/i }).click();
    await page.getByRole('radio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.getByRole('button', { name: /reset to defaults/i }).click();
    await page.getByRole('button', { name: /^no$/i }).click();

    // Theme unchanged; reset button reappears.
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.getByRole('button', { name: /reset to defaults/i })).toBeVisible();
  });
});
