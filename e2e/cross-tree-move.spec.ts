import { test, expect, type Page } from '@playwright/test';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MULTI_TREE_FIXTURE = path.join(__dirname, 'fixtures', 'multi-tree-with-subtree.json');

const nodes = (page: Page) => page.locator('.react-flow__node');
const tab = (page: Page, name: RegExp) => page.getByRole('tab', { name });

async function dropTwoActions(page: Page): Promise<void> {
  const canvas = page.locator('.react-flow');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas not found');
  const palette = page.getByRole('list').getByText('Action', { exact: true });
  await palette.dragTo(canvas, { targetPosition: { x: box.width / 2 - 90, y: 200 } });
  await palette.dragTo(canvas, { targetPosition: { x: box.width / 2 + 90, y: 200 } });
  await expect(nodes(page)).toHaveCount(3); // Root + 2 Actions
}

async function selectTwoActions(page: Page): Promise<void> {
  await nodes(page).nth(1).click();
  await nodes(page).nth(2).click({ modifiers: ['Shift'] });
}

function openMoveCopy(page: Page) {
  return page.getByRole('button', { name: /move or copy selection/i }).click();
}

// Phase B — node selection → Toolbar button → modal → store, with both tabs
// updating. The pure-op (T4, 14 tests), store (T5, 7), modal (T6, 7) and
// Toolbar (T7, 3) tests cover the precise semantics; this proves the wiring.
test.describe('Cross-tree Move/Copy (FR2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('#/editor');
    await expect(nodes(page)).toBeVisible();
    await dropTwoActions(page);
    await page.getByRole('button', { name: /create new tree/i }).click(); // Tree 2
    await tab(page, /Main/).click(); // back to Main
    await expect(nodes(page)).toHaveCount(3);
  });

  test('Move transfers the selection to Tree 2 and a single Ctrl+Z restores both', async ({ page }) => {
    await selectTwoActions(page);
    await openMoveCopy(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Move' }).click();

    // Active tab switched to Tree 2; it now holds its Root + the 2 moved nodes.
    await expect(tab(page, /Tree 2/)).toHaveAttribute('aria-selected', 'true');
    await expect(nodes(page)).toHaveCount(3);
    // Source emptied of the moved nodes (only Root remains) — AC Test 7.
    await tab(page, /Main/).click();
    await expect(nodes(page)).toHaveCount(1);

    // Single undo reverts both trees in one step. We're on Main now, and Main
    // still exists, so active stays Main (stillExists rule).
    await page.keyboard.press('Control+z');
    await expect(nodes(page)).toHaveCount(3); // Main restored
    await tab(page, /Tree 2/).click();
    await expect(nodes(page)).toHaveCount(1); // Tree 2 back to just its Root
  });

  test('Copy duplicates the selection into Tree 2, leaving the source intact', async ({ page }) => {
    await selectTwoActions(page);
    await openMoveCopy(page);

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: 'Copy' }).click();
    await dialog.getByRole('button', { name: 'Copy' }).click();

    await expect(tab(page, /Tree 2/)).toHaveAttribute('aria-selected', 'true');
    await expect(nodes(page)).toHaveCount(3); // Tree 2 Root + 2 copies
    await tab(page, /Main/).click();
    await expect(nodes(page)).toHaveCount(3); // source unchanged

    // Single undo removes the copy.
    await page.keyboard.press('Control+z');
    await tab(page, /Tree 2/).click();
    await expect(nodes(page)).toHaveCount(1);
  });

  test('V1: a selection containing Root blocks Confirm with a Root-conflict message', async ({ page }) => {
    // Ctrl+A selects every node including Root → V1 conflict with Tree 2's Root.
    // (The handler is on window; focus is on the Main tab, not an input.)
    await page.keyboard.press('Control+a');
    await openMoveCopy(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('alert')).toContainText(/Root node/i);
    await expect(dialog.getByRole('button', { name: 'Move' })).toBeDisabled();
  });
});

test.describe('Cross-tree Move/Copy — V2 cycle', () => {
  test('selecting a SubTree that references the destination blocks Confirm', async ({ page }) => {
    await page.goto('#/editor');
    await expect(nodes(page)).toBeVisible();
    // Fixture: Main has SubTree "Patrol behavior" (treeRef "Patrol") + a Patrol tree.
    await page.locator('[data-testid="toolbar-open-input"]').setInputFiles(MULTI_TREE_FIXTURE);
    await expect(page.getByRole('tablist', { name: 'Trees' }).getByRole('tab')).toHaveCount(2);

    await nodes(page).filter({ hasText: 'Patrol behavior' }).click();
    await openMoveCopy(page);

    const dialog = page.getByRole('dialog');
    // Only non-active tree is Patrol → default destination → cycle.
    await expect(dialog.getByRole('alert')).toContainText(/cycle/i);
    await expect(dialog.getByRole('button', { name: 'Move' })).toBeDisabled();
  });
});
