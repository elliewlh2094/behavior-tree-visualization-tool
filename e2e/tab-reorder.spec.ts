import { test, expect, type Page } from '@playwright/test';

const TABLIST = { name: 'Trees' } as const;

function tabs(page: Page) {
  return page.getByRole('tablist', TABLIST).getByRole('tab');
}

async function tabOrder(page: Page): Promise<string[]> {
  const texts = await tabs(page).allInnerTexts();
  return texts.map((t) => t.trim());
}

// dnd-kit's PointerSensor listens to pointer events (not HTML5 drag), so we
// drive a manual mouse gesture. The first move must clear the 5px activation
// distance before heading to the target; stepped moves give collision
// detection intermediate frames to resolve the `over` tab.
async function dragTabBefore(page: Page, fromName: RegExp, toName: RegExp): Promise<void> {
  const from = page.getByRole('tab', { name: fromName });
  const to = page.getByRole('tab', { name: toName });
  const fb = await from.boundingBox();
  const tb = await to.boundingBox();
  if (!fb || !tb) throw new Error('tab bounding box not found');

  await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2);
  await page.mouse.down();
  // Cross the activation constraint first.
  await page.mouse.move(fb.x + fb.width / 2 + 12, fb.y + fb.height / 2, { steps: 6 });
  // Aim at the left quarter of the target so the drop lands before it.
  const targetX = tb.x + tb.width * 0.25;
  const targetY = tb.y + tb.height / 2;
  await page.mouse.move(targetX, targetY, { steps: 12 });
  await page.mouse.move(targetX, targetY, { steps: 2 });
  await page.mouse.up();
}

test.describe('Tab reorder (FB3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /new tree/i }).click();
    await expect(page.locator('.react-flow__node')).toBeVisible();
    // Two more trees → strip is [Main, Tree 2, Tree 3].
    await page.getByRole('button', { name: /create new tree/i }).click();
    await page.getByRole('button', { name: /create new tree/i }).click();
    await expect(tabs(page)).toHaveCount(3);
    expect(await tabOrder(page)).toEqual(['Main', 'Tree 2', 'Tree 3']);
  });

  test('drag a tab to the front reorders the strip', async ({ page }) => {
    await dragTabBefore(page, /Tree 3/, /Main/);

    await expect
      .poll(() => tabOrder(page))
      .toEqual(['Tree 3', 'Main', 'Tree 2']);
  });

  test('Ctrl+Z restores the original tab order after a reorder', async ({ page }) => {
    await dragTabBefore(page, /Tree 3/, /Main/);
    await expect.poll(() => tabOrder(page)).toEqual(['Tree 3', 'Main', 'Tree 2']);

    await page.keyboard.press('Control+z');

    await expect
      .poll(() => tabOrder(page))
      .toEqual(['Main', 'Tree 2', 'Tree 3']);
  });

  test('× delete still works after DnD wiring', async ({ page }) => {
    // × only fades in on hover/focus.
    const tree2 = page.getByRole('tab', { name: /Tree 2/ });
    await tree2.hover();
    await page.getByRole('button', { name: /Delete Tree 2/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^Delete$/ }).click();

    await expect(tabs(page)).toHaveCount(2);
    expect(await tabOrder(page)).toEqual(['Main', 'Tree 3']);
  });

  test('double-click rename still works after DnD wiring', async ({ page }) => {
    await page.getByRole('tab', { name: /Tree 2/ }).dblclick();
    const input = page.getByLabel('Tree name');
    await expect(input).toBeVisible();
    await input.fill('Combat');
    await input.press('Enter');

    await expect(page.getByRole('tab', { name: /Combat/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Tree 2/ })).toHaveCount(0);
  });
});
