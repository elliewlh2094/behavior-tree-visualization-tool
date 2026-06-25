import { test, expect } from '@playwright/test';

// FR7 minimap. xyflow renders the minimap as an <svg> with our aria-label and
// one <rect class="react-flow__minimap-node"> per node — both need real layout
// measurement, so this is an e2e (jsdom can't size the xyflow panel).
test.describe('Minimap (FR7)', () => {
  test('renders on the canvas with one node rect per tree node', async ({ page }) => {
    await page.goto('#/editor');
    await expect(page.locator('.react-flow__node')).toHaveCount(1);

    const minimap = page.getByRole('img', { name: 'Tree minimap' });
    await expect(minimap).toBeVisible();
    await expect(page.locator('.react-flow__minimap-node')).toHaveCount(1);
  });
});
