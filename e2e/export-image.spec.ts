import { test, expect } from '@playwright/test';

// Real-browser coverage for v1.9 image export. The unit/component tests cover
// filename enforcement, modal behavior, and the error path with a mocked
// capture; what only a real browser can prove is that html-to-image actually
// captures the SVG-heavy React Flow viewport without throwing and that the
// browser download fires with the chosen filename. We assert the download
// event + filename, not pixel content (too brittle per the spec testing
// strategy).
test.describe('Export image (PNG)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /new tree/i }).click();
    await expect(page.locator('.react-flow__node')).toBeVisible();

    // Add one Action node so the export covers more than the lone Root.
    const canvas = page.locator('.react-flow');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    await page
      .getByRole('list')
      .getByText('Action', { exact: true })
      .dragTo(canvas, { targetPosition: { x: box.width / 2, y: 200 } });
    await expect(page.locator('.react-flow__node')).toHaveCount(2);
  });

  test('themed export downloads a .png', async ({ page }) => {
    await page.getByRole('button', { name: 'Export image' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Themed is the default mode.
    await expect(dialog.getByRole('radio', { name: /themed background/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await dialog.getByLabel('File name').fill('themed-tree');

    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('themed-tree.png');

    // Modal closes on success.
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('transparent export downloads a .png', async ({ page }) => {
    await page.getByRole('button', { name: 'Export image' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('radio', { name: /transparent/i }).click();
    await dialog.getByLabel('File name').fill('transparent-tree');

    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('transparent-tree.png');
  });
});
