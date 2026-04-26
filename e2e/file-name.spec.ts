import { test, expect } from '@playwright/test';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('File name workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /new tree/i }).click();
    await expect(page.locator('.react-flow__node')).toBeVisible();
  });

  test('fresh load shows "Untitled.json" in the toolbar', async ({ page }) => {
    await expect(page.getByTestId('toolbar-filename')).toHaveText('Untitled.json');
  });

  test('opening a file updates the toolbar filename to the loaded file name', async ({
    page,
  }) => {
    const fixturePath = path.join(__dirname, 'fixtures', '10-node-tree.json');
    await page.locator('[data-testid="toolbar-open-input"]').setInputFiles(fixturePath);

    await expect(page.locator('.react-flow__node')).toHaveCount(10);
    await expect(page.getByTestId('toolbar-filename')).toHaveText('10-node-tree.json');
  });

  test('rename + save downloads under the new file name', async ({ page }) => {
    // Click the filename to enter edit mode.
    await page.getByTestId('toolbar-filename').click();
    const input = page.getByTestId('toolbar-filename-input');
    await expect(input).toBeVisible();

    // Replace the value with a new name and confirm with Enter.
    await input.fill('renamed-tree.json');
    await input.press('Enter');

    // Display reverts to the read-only button with the new name.
    await expect(page.getByTestId('toolbar-filename')).toHaveText('renamed-tree.json');

    // Save and verify the download uses the new name.
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('renamed-tree.json');
  });

  test('Escape cancels the rename and reverts to the previous name', async ({ page }) => {
    await page.getByTestId('toolbar-filename').click();
    const input = page.getByTestId('toolbar-filename-input');
    await input.fill('discarded.json');
    await input.press('Escape');

    await expect(page.getByTestId('toolbar-filename')).toHaveText('Untitled.json');
  });

  test('omitting the .json extension appends it on confirm', async ({ page }) => {
    await page.getByTestId('toolbar-filename').click();
    const input = page.getByTestId('toolbar-filename-input');
    await input.fill('no-extension');
    await input.press('Enter');

    await expect(page.getByTestId('toolbar-filename')).toHaveText('no-extension.json');
  });
});
