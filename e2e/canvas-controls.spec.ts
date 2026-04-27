import { test, expect, type Locator } from '@playwright/test';

// React Flow renders each node with `style="... transform: translate(Xpx, Ypx) ..."`
// — the transform is the only reliable signal of world-space position from
// the DOM. boundingBox() would lie because it depends on viewport zoom/pan,
// both of which change when Layout runs setCenter.
async function getNodeTransform(node: Locator): Promise<string> {
  const style = (await node.getAttribute('style')) ?? '';
  const match = style.match(/transform:\s*([^;]+)/);
  return match?.[1]?.trim() ?? '';
}

test.describe('Canvas controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /new tree/i }).click();
    await expect(page.locator('.react-flow__node')).toBeVisible();
  });

  test('Grid toggle hides and shows the grid background', async ({ page }) => {
    // v1.3 Phase 2.6: the grid switch moved from the toolbar into the
    // Settings tab as a 2-segment On/Off pill (matches the Theme three-way).
    await page.getByRole('tab', { name: /settings/i }).click();
    const onRadio = page.getByRole('radio', { name: 'On' });
    const offRadio = page.getByRole('radio', { name: 'Off' });
    const grid = page.locator('.react-flow__background');

    await expect(onRadio).toHaveAttribute('aria-checked', 'true');
    await expect(grid).toBeVisible();

    await offRadio.click();
    await expect(offRadio).toHaveAttribute('aria-checked', 'true');
    await expect(grid).toHaveCount(0);

    await onRadio.click();
    await expect(onRadio).toHaveAttribute('aria-checked', 'true');
    await expect(grid).toBeVisible();
  });

  test('Auto layout reorganizes nodes and undo restores them in one step', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    // Drop two children at distinctly off-tree positions so layout has work
    // to do (a node at the natural Root-child position would no-op).
    // Scope to the NodePalette's <ul> so the per-kind labels in the
    // (off-screen) Settings drawer don't ambiguate the locator.
    const palette = page.getByRole('list');
    const paletteSequence = palette.getByText('Sequence', { exact: true });
    await paletteSequence.dragTo(canvas, { targetPosition: { x: 120, y: 320 } });
    const paletteAction = palette.getByText('Action', { exact: true });
    await paletteAction.dragTo(canvas, { targetPosition: { x: 640, y: 420 } });
    await expect(page.locator('.react-flow__node')).toHaveCount(3);

    // Connect Root → both children so they're part of the tree (orphans
    // would not be moved by the centered-row placement at (Root.x, ...)).
    const rootNode = page.locator('.react-flow__node').first();
    const sequenceNode = page.locator('.react-flow__node').nth(1);
    const actionNode = page.locator('.react-flow__node').nth(2);
    await rootNode
      .locator('.react-flow__handle-bottom')
      .dragTo(sequenceNode.locator('.react-flow__handle-top'));
    await rootNode
      .locator('.react-flow__handle-bottom')
      .dragTo(actionNode.locator('.react-flow__handle-top'));
    await expect(page.locator('.react-flow__edge')).toHaveCount(2);

    const sequenceBefore = await getNodeTransform(sequenceNode);
    const actionBefore = await getNodeTransform(actionNode);

    await page.getByRole('button', { name: /auto layout/i }).click();
    // setCenter animates 300ms; positions apply on the rAF before that.
    await page.waitForTimeout(500);

    const sequenceAfter = await getNodeTransform(sequenceNode);
    const actionAfter = await getNodeTransform(actionNode);
    expect(sequenceAfter).not.toBe(sequenceBefore);
    expect(actionAfter).not.toBe(actionBefore);

    // Single Ctrl+Z must restore both children — proves the layout is one
    // undo step, not N separate moveNode steps.
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(100);
    expect(await getNodeTransform(sequenceNode)).toBe(sequenceBefore);
    expect(await getNodeTransform(actionNode)).toBe(actionBefore);
  });
});
