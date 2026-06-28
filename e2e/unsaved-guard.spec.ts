import { test, expect, type Page } from '@playwright/test';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

// Enter the editor through the landing page so there is a history entry to go
// back to, then make an edit (drag a Sequence onto the canvas) to mark the
// document dirty.
async function enterEditorAndEdit(page: Page): Promise<void> {
  await page.goto('#/');
  await page.getByRole('button', { name: /go to editor/i }).click();
  await expect(page).toHaveURL(/#\/editor$/);
  await expect(page.locator('.react-flow__node')).toHaveCount(1);

  const canvas = page.locator('.react-flow');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');
  await page
    .getByRole('list')
    .getByText('Sequence', { exact: true })
    .dragTo(canvas, { targetPosition: { x: box.width / 2, y: 200 } });
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
}

test.describe('Unsaved-changes nav guard (FR9 / AD10)', () => {
  test('browser Back on a dirty editor is intercepted; Stay keeps the canvas', async ({
    page,
  }) => {
    await enterEditorAndEdit(page);

    // history.back() (the browser Back button) is a POP navigation, caught by
    // the router blocker — not beforeunload (no document unload on a hash change).
    await page.evaluate(() => window.history.back());

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      page.getByRole('button', { name: /stay on page/i }),
    ).toBeVisible();

    await page.getByRole('button', { name: /stay on page/i }).click();

    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/#\/editor$/);
    // Edits are intact — the navigation was cancelled.
    await expect(page.locator('.react-flow__node')).toHaveCount(2);
  });

  test('browser Back on a dirty editor; Leave discards and returns to landing', async ({
    page,
  }) => {
    await enterEditorAndEdit(page);

    await page.evaluate(() => window.history.back());
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: /leave page/i }).click();

    await expect(page).toHaveURL(/#\/$/);
    await expect(
      page.getByRole('button', { name: /go to editor/i }),
    ).toBeVisible();
  });

  test('a clean editor navigates back without a prompt', async ({ page }) => {
    await page.goto('#/');
    await page.getByRole('button', { name: /go to editor/i }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(1);

    // No edits → dirty is false → blocker is inactive → Back goes straight to landing.
    await page.evaluate(() => window.history.back());

    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('Unsaved-changes Open guard (FR9 / AD10)', () => {
  test('Open on a dirty editor shows the same custom modal (not a native confirm); Cancel keeps the doc', async ({
    page,
  }) => {
    await enterEditorAndEdit(page);

    await page.getByRole('button', { name: 'Open' }).click();

    // The shared custom modal — proving Open uses the same UI as the nav guard.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      page.getByRole('button', { name: /discard & open/i }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    // Document untouched.
    await expect(page.locator('.react-flow__node')).toHaveCount(2);
  });

  test('Open on a dirty editor: Discard & open replaces the document', async ({
    page,
  }) => {
    await enterEditorAndEdit(page);

    await page.getByRole('button', { name: 'Open' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Confirming proceeds to the file picker; load a 10-node fixture.
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: /discard & open/i }).click(),
    ]);
    await chooser.setFiles(path.join(FIXTURES, '10-node-tree.json'));

    await expect(page.locator('.react-flow__node')).toHaveCount(10);
  });
});
