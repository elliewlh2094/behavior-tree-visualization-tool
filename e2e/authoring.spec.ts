import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Behavior Tree Authoring', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // v1.1 added a start screen — dismiss it via "New Tree" to enter the editor.
    await page.getByRole('button', { name: /new tree/i }).click();
    // Wait for React Flow to mount and the Root node to render
    await expect(page.locator('.react-flow__node')).toBeVisible();
  });

  test('"New Tree" enters the editor with a single Root node', async ({ page }) => {
    // SPEC Success Criterion 1: editing on entry, single Root node
    const nodes = page.locator('.react-flow__node');
    await expect(nodes).toHaveCount(1);
    await expect(nodes.first()).toContainText('Root');
  });

  test('can add and connect a single node', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    // Add a Sequence node
    const paletteSequence = page.locator('aside').getByText('Sequence', { exact: true });
    await paletteSequence.dragTo(canvas, {
      targetPosition: { x: canvasBox.width / 2, y: 200 },
    });
    await expect(page.locator('.react-flow__node')).toHaveCount(2);

    // Connect Root to Sequence
    const rootNode = page.locator('.react-flow__node').first();
    const sequenceNode = page.locator('.react-flow__node').nth(1);
    const sourceHandle = rootNode.locator('.react-flow__handle-bottom');
    const targetHandle = sequenceNode.locator('.react-flow__handle-top');
    await sourceHandle.dragTo(targetHandle);

    // Verify edge created
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  });

  test('10-node tree: load, validate, save, reload, verify round-trip', async ({ page }) => {
    // Load a pre-built 10-node tree fixture (tests file I/O, the core SPEC requirement)
    const fixturePath = path.join(__dirname, 'fixtures', '10-node-tree.json');
    const fileInput = page.locator('[data-testid="toolbar-open-input"]');
    await fileInput.setInputFiles(fixturePath);

    // Verify tree loaded correctly
    await expect(page.locator('.react-flow__node')).toHaveCount(10);
    await expect(page.locator('.react-flow__edge')).toHaveCount(9);

    // Validate - should have no errors
    await page.getByRole('button', { name: 'Validate' }).click();
    const validationPanel = page.locator('[aria-label="Validation results"]');
    await expect(validationPanel).toBeVisible();
    const errorItems = validationPanel.locator('[aria-label="error"]');
    await expect(errorItems).toHaveCount(0);

    // Save the tree
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save' }).click();
    const download = await downloadPromise;

    // Read and verify saved content
    const downloadPath = await download.path();
    if (!downloadPath) throw new Error('Download failed');
    const savedJson = fs.readFileSync(downloadPath, 'utf-8');
    const savedTree = JSON.parse(savedJson);

    expect(savedTree.version).toBe(1);
    expect(savedTree.nodes).toHaveLength(10);
    expect(savedTree.connections).toHaveLength(9);

    // Reload the saved file
    const tempPath = path.join(__dirname, 'temp-tree.json');
    fs.writeFileSync(tempPath, savedJson);

    try {
      await fileInput.setInputFiles(tempPath);

      // Verify round-trip preserved the tree
      await expect(page.locator('.react-flow__node')).toHaveCount(10);
      await expect(page.locator('.react-flow__edge')).toHaveCount(9);

      // Re-validate to confirm integrity
      await page.getByRole('button', { name: 'Validate' }).click();
      await expect(validationPanel).toBeVisible();
      await expect(errorItems).toHaveCount(0);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  });

  test('undo/redo works for node operations', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    // Add a node
    const paletteSequence = page.locator('aside').getByText('Sequence', { exact: true });
    await paletteSequence.dragTo(canvas, {
      targetPosition: { x: canvasBox.width / 2, y: 200 },
    });
    await expect(page.locator('.react-flow__node')).toHaveCount(2);

    // Undo - should remove the node
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(1);

    // Redo - should restore the node
    await page.getByRole('button', { name: 'Redo' }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(2);
  });

  test('keyboard shortcuts work', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    // Add a node
    const paletteAction = page.locator('aside').getByText('Action', { exact: true });
    await paletteAction.dragTo(canvas, {
      targetPosition: { x: canvasBox.width / 2, y: 200 },
    });
    await expect(page.locator('.react-flow__node')).toHaveCount(2);

    // Ctrl+Z to undo
    await page.keyboard.press('Control+z');
    await expect(page.locator('.react-flow__node')).toHaveCount(1);

    // Ctrl+Shift+Z to redo
    await page.keyboard.press('Control+Shift+z');
    await expect(page.locator('.react-flow__node')).toHaveCount(2);

    // Select the Action node and delete it
    const actionNode = page.locator('.react-flow__node').filter({ hasText: 'Action' });
    await actionNode.click();
    await page.keyboard.press('Delete');
    await expect(page.locator('.react-flow__node')).toHaveCount(1);

    // Ctrl+S should trigger download
    const downloadPromise = page.waitForEvent('download');
    await page.keyboard.press('Control+s');
    await downloadPromise;
  });
});
