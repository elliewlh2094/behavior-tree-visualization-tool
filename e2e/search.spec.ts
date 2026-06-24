import { test, expect } from '@playwright/test';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// FR6 node search. Loads the 10-node fixture so there are several named nodes
// to match. Query "re" matches exactly two ("Retry", "Is Ready") in this tree.
test.describe('Node search (FR6)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('#/editor');
    await expect(page.locator('.react-flow__node')).toBeVisible();
    const fileInput = page.locator('[data-testid="toolbar-open-input"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', '10-node-tree.json'));
    await expect(page.locator('.react-flow__node')).toHaveCount(10);
  });

  test('Ctrl+F opens the search box; typing counts matches in the current tree', async ({
    page,
  }) => {
    // Move focus off the hidden file <input> (setInputFiles leaves it focused),
    // otherwise Ctrl+F is treated as an in-field keystroke and passes through.
    await page.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+f');
    const input = page.getByPlaceholder('Search nodes');
    await expect(input).toBeVisible();

    await input.fill('re');
    await expect(page.getByTitle('Matches in current tree')).toContainText('1/2');
  });

  test('Enter steps to the next match, Shift+Enter back', async ({ page }) => {
    // Move focus off the hidden file <input> (setInputFiles leaves it focused),
    // otherwise Ctrl+F is treated as an in-field keystroke and passes through.
    await page.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+f');
    const input = page.getByPlaceholder('Search nodes');
    await input.fill('re');
    const counter = page.getByTitle('Matches in current tree');
    await expect(counter).toContainText('1/2');

    await input.press('Enter');
    await expect(counter).toContainText('2/2');
    await input.press('Shift+Enter');
    await expect(counter).toContainText('1/2');
  });

  test('Escape closes the search box', async ({ page }) => {
    // Move focus off the hidden file <input> (setInputFiles leaves it focused),
    // otherwise Ctrl+F is treated as an in-field keystroke and passes through.
    await page.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+f');
    const input = page.getByPlaceholder('Search nodes');
    await expect(input).toBeVisible();

    await input.press('Escape');
    await expect(input).toHaveCount(0);
  });
});
