import { test, expect, type Locator } from '@playwright/test';

// offsetHeight is the element's laid-out height in CSS pixels, unaffected by the
// canvas pan/zoom transform (unlike boundingBox()).
function offsetHeight(node: Locator): Promise<number> {
  return node.evaluate((el) => (el as HTMLElement).offsetHeight);
}

test.describe('Node label wrapping (FB5)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('#/editor');
    await expect(page.locator('.react-flow__node')).toBeVisible();
  });

  // Measures the label element (`.line-clamp-2`), not the node wrapper: the
  // 75px node floor already accommodates two lines of text + the kind badge,
  // so the wrapper itself does not grow for a 2-line label. The user-facing
  // win is that the label wraps to a second line instead of truncating, which
  // shows up as the label box doubling in height.
  test('a long node name wraps to a second line instead of truncating', async ({
    page,
  }) => {
    const canvas = page.locator('.react-flow');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    await page
      .getByRole('list')
      .getByText('Action', { exact: true })
      .dragTo(canvas, { targetPosition: { x: canvasBox.width / 2, y: 220 } });
    await expect(page.locator('.react-flow__node')).toHaveCount(2);
    const actionNode = page.locator('.react-flow__node').nth(1);
    await actionNode.click();

    const nameInput = page.getByRole('textbox', { name: /^name$/i });
    const label = actionNode.locator('.line-clamp-2');

    // Short name → single line.
    await nameInput.fill('Step');
    const oneLine = await offsetHeight(label);

    // Long name → wraps to a second line → label box roughly doubles.
    await nameInput.fill('This is a very long behavior name that should wrap');
    await expect.poll(() => offsetHeight(label)).toBeGreaterThan(oneLine);

    // Back to a short name → label returns to a single line.
    await nameInput.fill('Step');
    await expect.poll(() => offsetHeight(label)).toBe(oneLine);
  });
});
