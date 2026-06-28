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

  test('the Chase template card loads its tree onto the editor canvas (FR8)', async ({
    page,
  }) => {
    await page.goto('#/');

    // The Chase card's accessible name folds in its description, so this
    // substring uniquely targets it (the Patrol card's blurb differs).
    await page.getByRole('button', { name: /pursue a visible target/i }).click();

    await expect(page).toHaveURL(/#\/editor$/);
    // Chase main tree: Root + Fallback + Sequence + 2 Condition + 2 Action + SubTree.
    await expect(page.locator('.react-flow__node')).toHaveCount(8);
    await expect(
      page.locator('.react-flow__node').filter({ hasText: 'Chase or give up' }),
    ).toBeVisible();
  });

  test('"Go to Editor" always opens a blank tree, even after a template was loaded (FR8)', async ({
    page,
  }) => {
    await page.goto('#/');
    // Load Chase (8 nodes), then go back to the landing page.
    await page.getByRole('button', { name: /pursue a visible target/i }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(8);
    await page.goBack();
    await expect(
      page.getByRole('button', { name: /go to editor/i }),
    ).toBeVisible();

    // Go to Editor resets the store: a fresh single-Root canvas, not the Chase tree.
    await page.getByRole('button', { name: /go to editor/i }).click();
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
