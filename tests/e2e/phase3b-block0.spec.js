import { test, expect } from '@playwright/test';

test.describe('Phase 3B Block 0: Error Toast', () => {
  test('should show error toast when inserting a second block into a chain', async ({ page }) => {
    await page.goto('/');

    // 1. Setup initial state with two separate blocks
    await page.evaluate(() => {
        if (window.editor) {
          window.editor.setValue('[bvh("deep_breath")]; [bvh("surprise")]');
        }
    });
    await page.waitForTimeout(300);

    // 2. Open drawer and click an animation to trigger insertion error
    const drawerToggle = page.locator('#drawer-toggle');
    if (await drawerToggle.isVisible()) {
      await drawerToggle.click();
    }
    const bvhItem = page.locator('.bvh-item').first();
    await bvhItem.click();

    // 3. Verify Error Toast appears
    const errorToast = page.locator('#error-toast');
    await expect(errorToast).toHaveClass(/visible/);
    const errorTextElem = page.locator('#error-text');
    await expect(errorTextElem).toHaveText(/Solo se permite una secuencia continua/);

    // 4. Verify code is intact (no changes)
    const code = await page.evaluate(() => window.editor ? window.editor.getValue() : '');
    expect(code).toBe('[bvh("deep_breath")]; [bvh("surprise")]');
  });
});
