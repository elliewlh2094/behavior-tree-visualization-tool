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

  test('Ctrl+Z after renameTree restores tab label and SubTree node display (v1.7.1)', async ({ page }) => {
    // Reproduces the v1.4 smoke bug: rename a tree, undo, and pre-v1.7 the
    // referenced SubTree node would revert but the tree definition + tab
    // label would stay renamed. v1.7 made this atomic; v1.7.1 keeps the
    // user on whatever tab they were on rather than teleporting them to
    // the snapshot's active tab.
    const fileInput = page.locator('[data-testid="toolbar-open-input"]');
    await fileInput.setInputFiles(MULTI_TREE_FIXTURE);
    await expect(page.getByRole('tablist', { name: 'Trees' }).getByRole('tab')).toHaveCount(2);
    await expect(page.locator('.react-flow__node').filter({ hasText: 'Patrol behavior' })).toBeVisible();

    // Rename Patrol → Recon via the tab (active flips to Patrol on dblclick).
    await page.getByRole('tab', { name: /Patrol/ }).dblclick();
    const input = page.getByLabel('Tree name');
    await input.fill('Recon');
    await input.press('Enter');
    await expect(page.getByRole('tab', { name: /Recon/ })).toBeVisible();

    // Switch back to Main — the user is now visually on Main.
    await page.getByRole('tab', { name: /Main/ }).click();
    await expect(page.getByRole('tab', { name: /Main/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.react-flow__node').filter({ hasText: 'Recon' })).toBeVisible();

    // Ctrl+Z — content reverts (tab label + SubTree node display).
    // Active tab does NOT teleport: Main still exists in the restored doc,
    // so the user stays on Main per the v1.7.1 active-tab fallback rule.
    await page.keyboard.press('Control+z');

    await expect(page.getByRole('tab', { name: /Patrol/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Recon/ })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /Main/ })).toHaveAttribute('aria-selected', 'true');
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

  test('v1.7.1 unified history: 5-action scenario undoes/redoes chronologically across tab switches', async ({ page }) => {
    // Reproduces the user's reported smoke scenario verbatim and verifies
    // both directions (undo + redo) hold their order regardless of which
    // tab the user pre-switches to before each press.

    const canvas = page.locator('.react-flow');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    async function dragPaletteOnto(kind: string, y: number) {
      await page
        .getByRole('list')
        .getByText(kind, { exact: true })
        .dragTo(canvas, { targetPosition: { x: canvasBox!.width / 2, y } });
    }

    // Step 1: Add Tree 2 (auto-active).
    await page.getByRole('button', { name: /create new tree/i }).click();
    await expect(page.getByRole('tab', { name: /Tree 2/ })).toHaveAttribute('aria-selected', 'true');

    // Step 2: Switch to Main, drag Sequence onto canvas.
    await page.getByRole('tab', { name: /Main/ }).click();
    await dragPaletteOnto('Sequence', 200);
    await expect(page.locator('.react-flow__node')).toHaveCount(2);

    // Step 3: Switch to Tree 2, rename via dblclick → Recon.
    await page.getByRole('tab', { name: /Tree 2/ }).click();
    await page.getByRole('tab', { name: /Tree 2/ }).dblclick();
    const renameInput = page.getByLabel('Tree name');
    await renameInput.fill('Recon');
    await renameInput.press('Enter');
    await expect(page.getByRole('tab', { name: /Recon/ })).toBeVisible();

    // Step 4: Drag Action onto Recon canvas.
    await dragPaletteOnto('Action', 200);
    await expect(page.locator('.react-flow__node')).toHaveCount(2);

    // Step 5: Switch to Main, drag Decorator.
    await page.getByRole('tab', { name: /Main/ }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(2); // Root + Sequence
    await dragPaletteOnto('Decorator', 320);
    await expect(page.locator('.react-flow__node')).toHaveCount(3);

    // ---- UNDO with tab-switching between presses ----
    // Helper to switch tabs only if the target tab still exists.
    async function maybeSwitchTo(label: RegExp) {
      const tab = page.getByRole('tab', { name: label });
      if ((await tab.count()) > 0) await tab.click();
    }

    // Undo #1: Decorator gone from Main. (Switch to Recon first to verify
    // tab-switch invariance.)
    await maybeSwitchTo(/Recon/);
    await page.keyboard.press('Control+z');
    await page.getByRole('tab', { name: /Main/ }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(2); // Root + Sequence (no Decorator)

    // Undo #2: Action gone from Recon. (Switch to Main first.)
    await page.getByRole('tab', { name: /Main/ }).click();
    await page.keyboard.press('Control+z');
    await page.getByRole('tab', { name: /Recon/ }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(1); // Root only

    // Undo #3: Recon → Tree 2 (rename reverts). (Switch to Main first.)
    await page.getByRole('tab', { name: /Main/ }).click();
    await page.keyboard.press('Control+z');
    await expect(page.getByRole('tab', { name: /Tree 2/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Recon/ })).toHaveCount(0);

    // Undo #4: Sequence gone from Main. (Switch to Tree 2 first.)
    await page.getByRole('tab', { name: /Tree 2/ }).click();
    await page.keyboard.press('Control+z');
    await page.getByRole('tab', { name: /Main/ }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(1); // Root only

    // Undo #5: Tree 2 disappears (addTree undone).
    await maybeSwitchTo(/Tree 2/);
    await page.keyboard.press('Control+z');
    await expect(page.getByRole('tablist', { name: 'Trees' }).getByRole('tab')).toHaveCount(1);
    await expect(page.getByRole('tab', { name: /Main/ })).toHaveAttribute('aria-selected', 'true');

    // Undo #6: empty stack — no-op.
    await page.keyboard.press('Control+z');
    await expect(page.getByRole('tablist', { name: 'Trees' }).getByRole('tab')).toHaveCount(1);

    // ---- REDO with tab-switching ----

    // Redo #1: Tree 2 reappears.
    await page.keyboard.press('Control+Shift+z');
    await expect(page.getByRole('tablist', { name: 'Trees' }).getByRole('tab')).toHaveCount(2);
    await expect(page.getByRole('tab', { name: /Tree 2/ })).toBeVisible();

    // Redo #2: Sequence back on Main. (Switch to Tree 2 first.)
    await page.getByRole('tab', { name: /Tree 2/ }).click();
    await page.keyboard.press('Control+Shift+z');
    await page.getByRole('tab', { name: /Main/ }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(2);

    // Redo #3: Tree 2 → Recon (rename redone). (Switch to Main first.)
    await page.getByRole('tab', { name: /Main/ }).click();
    await page.keyboard.press('Control+Shift+z');
    await expect(page.getByRole('tab', { name: /Recon/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Tree 2/ })).toHaveCount(0);

    // Redo #4: Action back on Recon. (Switch to Main first.)
    await page.getByRole('tab', { name: /Main/ }).click();
    await page.keyboard.press('Control+Shift+z');
    await page.getByRole('tab', { name: /Recon/ }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(2);

    // Redo #5: Decorator back on Main. (Switch to Recon first.)
    await page.getByRole('tab', { name: /Recon/ }).click();
    await page.keyboard.press('Control+Shift+z');
    await page.getByRole('tab', { name: /Main/ }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(3);

    // Redo #6: empty redo stack — no-op.
    await page.keyboard.press('Control+Shift+z');
    await expect(page.locator('.react-flow__node')).toHaveCount(3);
  });

  test('v1.7.1 unified history: undo never moves the active tab unless it disappears', async ({ page }) => {
    // Setup: 3 tabs (Main + Tree 2 + Tree 3). User on Main throughout.
    await page.getByRole('button', { name: /create new tree/i }).click(); // Tree 2 auto-active
    await page.getByRole('button', { name: /create new tree/i }).click(); // Tree 3 auto-active

    // Switch to Main and make a per-tree edit, then a cross-tree edit, then
    // verify undo lands the user back on Main both times.
    await page.getByRole('tab', { name: /Main/ }).click();
    await expect(page.getByRole('tab', { name: /Main/ })).toHaveAttribute('aria-selected', 'true');

    const canvas = page.locator('.react-flow');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    // Per-tree edit: add a Sequence on Main.
    await page
      .getByRole('list')
      .getByText('Sequence', { exact: true })
      .dragTo(canvas, { targetPosition: { x: canvasBox.width / 2, y: 200 } });
    await expect(page.locator('.react-flow__node')).toHaveCount(2);

    // Cross-tree edit: rename Tree 2 from Main tab via the tab dblclick.
    // (Tab dblclick activates the tab; restore Main when done.)
    await page.getByRole('tab', { name: /Tree 2/ }).dblclick();
    const renameInput = page.getByLabel('Tree name');
    await renameInput.fill('Renamed');
    await renameInput.press('Enter');
    await page.getByRole('tab', { name: /Main/ }).click();
    await expect(page.getByRole('tab', { name: /Main/ })).toHaveAttribute('aria-selected', 'true');

    // Undo the rename — user is on Main, Main exists in restored doc, so
    // active stays on Main (no teleport to Tree 2 / Renamed).
    await page.keyboard.press('Control+z');
    await expect(page.getByRole('tab', { name: /Main/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: /Tree 2/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Renamed/ })).toHaveCount(0);

    // Undo the per-tree edit — still on Main.
    await page.keyboard.press('Control+z');
    await expect(page.getByRole('tab', { name: /Main/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
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

  test('SubTree name is read-only and Open Subtree switches to the referenced tab (B1, FB4)', async ({ page }) => {
    const fileInput = page.locator('[data-testid="toolbar-open-input"]');
    await fileInput.setInputFiles(MULTI_TREE_FIXTURE);
    await expect(page.getByRole('tablist', { name: 'Trees' }).getByRole('tab')).toHaveCount(2);

    // Select the SubTree node that references the Patrol tree.
    await page
      .locator('.react-flow__node')
      .filter({ hasText: 'Patrol behavior' })
      .click();

    // B1: no editable Name textbox is rendered for a SubTree — the name is a
    // read-only mirror of the referenced tree's name.
    await expect(page.getByRole('textbox', { name: /^name$/i })).toHaveCount(0);

    // FB4: Open subtree activates the referenced Patrol tab.
    await page.getByRole('button', { name: /open subtree/i }).click();
    await expect(page.getByRole('tab', { name: /Patrol/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
