import { test, expect } from '@playwright/test';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Start Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Note: do NOT dismiss the start screen here — these tests are about it.
  });

  test('fresh load shows brand, icon, tagline, and the two CTA buttons', async ({
    page,
  }) => {
    await expect(
      page.getByRole('heading', { name: 'BT Visualizer' }),
    ).toBeVisible();
    await expect(page.getByText(/author, visualize, and validate/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /new tree/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /open file/i })).toBeVisible();
    // Editor canvas is not yet mounted.
    await expect(page.locator('.react-flow')).toHaveCount(0);
  });

  test('"New Tree" enters the editor with a single Root node', async ({ page }) => {
    await page.getByRole('button', { name: /new tree/i }).click();

    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    await expect(page.locator('.react-flow__node').first()).toContainText('Root');
    // Start screen is gone.
    await expect(page.getByRole('heading', { name: 'BT Visualizer' })).toHaveCount(0);
  });

  test('reload re-shows the start screen (no persistence)', async ({ page }) => {
    await page.getByRole('button', { name: /new tree/i }).click();
    await expect(page.locator('.react-flow__node')).toBeVisible();

    await page.reload();

    await expect(
      page.getByRole('heading', { name: 'BT Visualizer' }),
    ).toBeVisible();
    await expect(page.locator('.react-flow')).toHaveCount(0);
  });

  test('"Open File" with a valid fixture loads the tree and enters the editor', async ({
    page,
  }) => {
    const fixturePath = path.join(__dirname, 'fixtures', '10-node-tree.json');
    await page
      .locator('[data-testid="start-screen-open-input"]')
      .setInputFiles(fixturePath);

    await expect(page.locator('.react-flow__node')).toHaveCount(10);
    await expect(page.locator('.react-flow__edge')).toHaveCount(9);
    await expect(page.getByTestId('toolbar-filename')).toHaveText('10-node-tree.json');
  });

  test('"Open File" with malformed JSON shows an error and stays on the start screen', async ({
    page,
  }) => {
    // Synthesize a broken file in-memory and feed it to the input.
    await page.locator('[data-testid="start-screen-open-input"]').setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{not valid json'),
    });

    await expect(page.getByRole('alert')).toBeVisible();
    // Still on the start screen.
    await expect(
      page.getByRole('heading', { name: 'BT Visualizer' }),
    ).toBeVisible();
    await expect(page.locator('.react-flow')).toHaveCount(0);
  });
});
