import { test, expect } from '@playwright/test';

// Lean happy-path coverage for the v1.5 duplicate action. T1's pure-op
// tests cover the precise filter / offset / boundary-edge / SubTree
// behaviors (11 cases) and T2's store tests cover the no-op shapes and
// single-undo restore (7 cases). What this test verifies that those
// can't: the keyboard shortcut wires through xyflow's multi-select and
// the Toolbar's keydown listener all the way to the store action.
test.describe('Duplicate Selection (Ctrl+D)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('#/editor');
    await expect(page.locator('.react-flow__node')).toBeVisible();
  });

  test('Ctrl+D duplicates the selected nodes; Ctrl+Z restores', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    // Drop two Action nodes onto the canvas (Root is auto-present from
    // "New Tree"). Total: 3 nodes.
    const paletteAction = page.getByRole('list').getByText('Action', { exact: true });
    await paletteAction.dragTo(canvas, {
      targetPosition: { x: canvasBox.width / 2 - 80, y: 200 },
    });
    await paletteAction.dragTo(canvas, {
      targetPosition: { x: canvasBox.width / 2 + 80, y: 200 },
    });
    await expect(page.locator('.react-flow__node')).toHaveCount(3);

    // Multi-select the two Actions via Shift+Click. xyflow's
    // multiSelectionKeyCode includes Shift, so Shift+Click extends
    // selection rather than replacing it.
    const nodes = page.locator('.react-flow__node');
    await nodes.nth(1).click();
    await nodes.nth(2).click({ modifiers: ['Shift'] });

    // Ctrl+D → duplicate. Result: 5 nodes (Root + 2 originals + 2 duplicates).
    await page.keyboard.press('Control+d');
    await expect(page.locator('.react-flow__node')).toHaveCount(5);

    // The duplicates are now the active selection, the originals are not.
    // xyflow tags selected nodes with the `.selected` class; exactly 2
    // should carry it after the duplicate.
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(2);

    // Ctrl+Z restores. Single history step → one undo is enough.
    await page.keyboard.press('Control+z');
    await expect(page.locator('.react-flow__node')).toHaveCount(3);
  });
});
