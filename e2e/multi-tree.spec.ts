import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MULTI_TREE_FIXTURE = path.join(__dirname, 'fixtures', 'multi-tree-with-subtree.json');
const V1_FIXTURE = path.join(__dirname, 'fixtures', '10-node-tree.json');

test.describe('Multi-tree workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /new tree/i }).click();
    await expect(page.locator('.react-flow__node')).toBeVisible();
  });

  test('"+" creates a second tree, becomes active, and switching tabs swaps canvas content', async ({ page }) => {
    // Single tab on entry (matches the Main tree from createEmptyDocument).
    await expect(page.getByRole('tablist', { name: 'Trees' }).getByRole('tab')).toHaveCount(1);

    await page.getByRole('button', { name: /create new tree/i }).click();

    const tabs = page.getByRole('tablist', { name: 'Trees' }).getByRole('tab');
    await expect(tabs).toHaveCount(2);
    // The newly created tab is active and named "Tree 2".
    const tree2 = page.getByRole('tab', { name: /Tree 2/ });
    await expect(tree2).toHaveAttribute('aria-selected', 'true');

    // Add a node on Tree 2's canvas so we can prove tab switching changes content.
    const canvas = page.locator('.react-flow');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');
    await page
      .getByRole('list')
      .getByText('Sequence', { exact: true })
      .dragTo(canvas, { targetPosition: { x: canvasBox.width / 2, y: 200 } });
    await expect(page.locator('.react-flow__node')).toHaveCount(2);

    // Switch back to Main — Tree 2's Sequence should be gone, only Main's Root remains.
    await page.getByRole('tab', { name: /Main/ }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    await expect(page.locator('.react-flow__node').first()).toContainText('Root');

    // Switch back to Tree 2 — Sequence reappears (per-tab isolation).
    await tree2.click();
    await expect(page.locator('.react-flow__node')).toHaveCount(2);
  });

  test('double-click a tab to rename it', async ({ page }) => {
    await page.getByRole('button', { name: /create new tree/i }).click();
    const tree2 = page.getByRole('tab', { name: /Tree 2/ });
    await tree2.dblclick();

    const input = page.getByLabel('Tree name');
    await expect(input).toBeVisible();
    await input.fill('Combat');
    await input.press('Enter');

    await expect(page.getByRole('tab', { name: /Combat/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Tree 2/ })).toHaveCount(0);
  });

  test('renaming a tree propagates to SubTree nodes that referenced its old name', async ({ page }) => {
    // Fixture: Main contains a SubTree whose treeRef = "Patrol" and name = "Patrol behavior".
    // After renaming Patrol → Recon, T9's invariant snaps both treeRef and name on the
    // referencing node, so the canvas label changes from "Patrol behavior" to "Recon".
    const fileInput = page.locator('[data-testid="toolbar-open-input"]');
    await fileInput.setInputFiles(MULTI_TREE_FIXTURE);
    await expect(page.getByRole('tablist', { name: 'Trees' }).getByRole('tab')).toHaveCount(2);

    // Verify pre-rename: Main tab is active by default after open; SubTree shows old name.
    await expect(page.locator('.react-flow__node').filter({ hasText: 'Patrol behavior' })).toBeVisible();

    // Rename Patrol → Recon via the tab.
    await page.getByRole('tab', { name: /Patrol/ }).dblclick();
    const input = page.getByLabel('Tree name');
    await input.fill('Recon');
    await input.press('Enter');

    // Tab label updated.
    await expect(page.getByRole('tab', { name: /Recon/ })).toBeVisible();
    // Switch back to Main; SubTree node's text snapped to the new name.
    await page.getByRole('tab', { name: /Main/ }).click();
    await expect(page.locator('.react-flow__node').filter({ hasText: 'Recon' })).toBeVisible();
    await expect(page.locator('.react-flow__node').filter({ hasText: 'Patrol behavior' })).toHaveCount(0);
  });

  test('clicking × on a non-main tab opens a confirm modal; Delete removes the tree', async ({ page }) => {
    const fileInput = page.locator('[data-testid="toolbar-open-input"]');
    await fileInput.setInputFiles(MULTI_TREE_FIXTURE);
    await expect(page.getByRole('tablist', { name: 'Trees' }).getByRole('tab')).toHaveCount(2);

    // The × button only fades in on hover or focus. Hover the Patrol tab first.
    const patrolTab = page.getByRole('tab', { name: /Patrol/ });
    await patrolTab.hover();
    await page.getByRole('button', { name: /Delete Patrol/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Patrol');

    await dialog.getByRole('button', { name: /^Delete$/ }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('tablist', { name: 'Trees' }).getByRole('tab')).toHaveCount(1);
    await expect(page.getByRole('tab', { name: /Main/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('Cancel on the delete dialog leaves the tree intact', async ({ page }) => {
    const fileInput = page.locator('[data-testid="toolbar-open-input"]');
    await fileInput.setInputFiles(MULTI_TREE_FIXTURE);
    await expect(page.getByRole('tablist', { name: 'Trees' }).getByRole('tab')).toHaveCount(2);

    const patrolTab = page.getByRole('tab', { name: /Patrol/ });
    await patrolTab.hover();
    await page.getByRole('button', { name: /Delete Patrol/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /Cancel/ }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('tablist', { name: 'Trees' }).getByRole('tab')).toHaveCount(2);
  });

  test('save → reload preserves multi-tree document and SubTree references', async ({ page }) => {
    const fileInput = page.locator('[data-testid="toolbar-open-input"]');
    await fileInput.setInputFiles(MULTI_TREE_FIXTURE);
    await expect(page.getByRole('tablist', { name: 'Trees' }).getByRole('tab')).toHaveCount(2);

    // Save.
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save' }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    if (!downloadPath) throw new Error('Download failed');

    const savedJson = fs.readFileSync(downloadPath, 'utf-8');
    const saved = JSON.parse(savedJson);
    expect(saved.version).toBe(2);
    expect(saved.trees).toHaveLength(2);
    const savedMain = saved.trees.find((t: { name: string }) => t.name === 'Main')!;
    const subtreeNode = savedMain.nodes.find((n: { kind: string }) => n.kind === 'SubTree' && n.name === 'Patrol behavior');
    expect(subtreeNode.treeRef).toBe('Patrol');

    // Round-trip: write, reload, verify both trees + SubTree node.
    const tempPath = path.join(__dirname, 'temp-multi-tree.json');
    fs.writeFileSync(tempPath, savedJson);
    try {
      await fileInput.setInputFiles(tempPath);
      await expect(page.getByRole('tablist', { name: 'Trees' }).getByRole('tab')).toHaveCount(2);
      await expect(page.getByRole('tab', { name: /Main/ })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Patrol/ })).toBeVisible();
      // SubTree node still labelled "Patrol behavior" after round-trip.
      await expect(page.locator('.react-flow__node').filter({ hasText: 'Patrol behavior' })).toBeVisible();
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  });

  test('Ctrl+Z after renameTree restores tab label and SubTree node display (v1.7)', async ({ page }) => {
    // Reproduces the v1.4 smoke bug: rename a tree, undo, and pre-v1.7 the
    // referenced SubTree node would revert but the tree definition + tab
    // label would stay renamed. v1.7 makes this atomic via the global stack.
    const fileInput = page.locator('[data-testid="toolbar-open-input"]');
    await fileInput.setInputFiles(MULTI_TREE_FIXTURE);
    await expect(page.getByRole('tablist', { name: 'Trees' }).getByRole('tab')).toHaveCount(2);
    // Before rename: SubTree node in Main displays "Patrol behavior".
    await expect(page.locator('.react-flow__node').filter({ hasText: 'Patrol behavior' })).toBeVisible();

    // Rename Patrol → Recon via the tab.
    await page.getByRole('tab', { name: /Patrol/ }).dblclick();
    const input = page.getByLabel('Tree name');
    await input.fill('Recon');
    await input.press('Enter');
    await expect(page.getByRole('tab', { name: /Recon/ })).toBeVisible();
    // Switch back to Main; SubTree node renamed to "Recon".
    await page.getByRole('tab', { name: /Main/ }).click();
    await expect(page.locator('.react-flow__node').filter({ hasText: 'Recon' })).toBeVisible();
    await expect(page.locator('.react-flow__node').filter({ hasText: 'Patrol behavior' })).toHaveCount(0);

    // Ctrl+Z — the bug fix: tab label, tree definition, and SubTree node display all revert.
    // Per v1.7 decision 7, undo also restores the activeTreeId captured at push time
    // (which was 'patrol' here, since dblclick activated Patrol before the rename
    // committed), so the active tab flips back to Patrol. Switch to Main to verify
    // the SubTree node's text reverted on its canvas.
    await page.keyboard.press('Control+z');

    await expect(page.getByRole('tab', { name: /Patrol/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Recon/ })).toHaveCount(0);
    await page.getByRole('tab', { name: /Main/ }).click();
    await expect(page.locator('.react-flow__node').filter({ hasText: 'Patrol behavior' })).toBeVisible();
    await expect(page.locator('.react-flow__node').filter({ hasText: 'Recon' })).toHaveCount(0);
  });

  test('Ctrl+Z after addTree removes the new tab and restores prior active tab (v1.7)', async ({ page }) => {
    // Single tab on entry.
    await expect(page.getByRole('tablist', { name: 'Trees' }).getByRole('tab')).toHaveCount(1);

    await page.getByRole('button', { name: /create new tree/i }).click();
    await expect(page.getByRole('tablist', { name: 'Trees' }).getByRole('tab')).toHaveCount(2);
    await expect(page.getByRole('tab', { name: /Tree 2/ })).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('Control+z');

    await expect(page.getByRole('tablist', { name: 'Trees' }).getByRole('tab')).toHaveCount(1);
    await expect(page.getByRole('tab', { name: /Main/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('Ctrl+Z after deleteTree restores the deleted tab without auto-activating it (v1.7.1)', async ({ page }) => {
    const fileInput = page.locator('[data-testid="toolbar-open-input"]');
    await fileInput.setInputFiles(MULTI_TREE_FIXTURE);
    await expect(page.getByRole('tablist', { name: 'Trees' }).getByRole('tab')).toHaveCount(2);

    // Activate Patrol then delete it. The auto-switch lands the user on Main.
    const patrolTab = page.getByRole('tab', { name: /Patrol/ });
    await patrolTab.click();
    await expect(patrolTab).toHaveAttribute('aria-selected', 'true');

    await patrolTab.hover();
    await page.getByRole('button', { name: /Delete Patrol/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^Delete$/ }).click();
    await expect(page.getByRole('tablist', { name: 'Trees' }).getByRole('tab')).toHaveCount(1);
    await expect(page.getByRole('tab', { name: /Main/ })).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('Control+z');

    // v1.7.1 active-tab fallback rule: 'main' still exists in the restored
    // doc, so the user stays on Main. Patrol comes back as a tab but is NOT
    // auto-activated — clicking it is the user's choice.
    await expect(page.getByRole('tablist', { name: 'Trees' }).getByRole('tab')).toHaveCount(2);
    await expect(page.getByRole('tab', { name: /Patrol/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Main/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: /Patrol/ })).toHaveAttribute('aria-selected', 'false');
  });

  test('opening a v1 file produces a single-tab v2 document', async ({ page }) => {
    const fileInput = page.locator('[data-testid="toolbar-open-input"]');
    await fileInput.setInputFiles(V1_FIXTURE);

    // v1 has no notion of multiple trees — migration produces a single Main tab.
    await expect(page.getByRole('tablist', { name: 'Trees' }).getByRole('tab')).toHaveCount(1);
    await expect(page.getByRole('tab', { name: /Main/ })).toBeVisible();
    // v1 fixture has 10 nodes; they all live under the single migrated tree.
    await expect(page.locator('.react-flow__node')).toHaveCount(10);
  });
});
