import { test, expect } from '@playwright/test';

test.describe('Landing page + routing', () => {
  test('#/ renders the landing hero with a "Go to Editor" CTA', async ({
    page,
  }) => {
    await page.goto('#/');

    await expect(
      page.getByRole('heading', { name: 'BT Visualizer', level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /go to editor/i }),
    ).toBeVisible();
    // Editor is not mounted on the landing route.
    await expect(page.locator('.react-flow')).toHaveCount(0);
  });

  test('"Go to Editor" navigates to #/editor and drops onto the canvas', async ({
    page,
  }) => {
    await page.goto('#/');
    await page.getByRole('button', { name: /go to editor/i }).click();

    await expect(page).toHaveURL(/#\/editor$/);
    // No intermediate start screen: the seeded single-Root canvas shows directly.
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    await expect(page.locator('.react-flow__node').first()).toContainText('Root');
  });

  test('directly loading #/editor and reloading stays on the editor canvas', async ({
    page,
  }) => {
    await page.goto('#/editor');
    await expect(page.locator('.react-flow__node')).toHaveCount(1);

    await page.reload();

    // HashRouter needs no server rewrite: refresh keeps #/editor on the canvas.
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: /go to editor/i }),
    ).toHaveCount(0);
  });
});
