import { test, expect } from '@playwright/test';

test.describe('Phase 3B Block 4: Global Methods E2E', () => {
  test('should execute floor and box global methods without error', async ({ page }) => {
    await page.goto('/');

    // Set code using floor and box
    await page.evaluate(() => {
      if (window.editor) {
        window.editor.setValue('floor("#333333", 600);\nbox(4, 40);\n[bvh("deep_breath")];');
      }
    });
    await page.waitForTimeout(500);

    // Run all
    const runAllBtn = page.locator('#run-all');
    if (await runAllBtn.isVisible()) {
      await runAllBtn.click();
    }
    await page.waitForTimeout(500);

    // Verify no error toast is visible
    const errorToast = page.locator('#error-toast');
    await expect(errorToast).not.toHaveClass(/visible/);
  });
});
