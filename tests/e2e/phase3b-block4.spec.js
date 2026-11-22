import { test, expect } from '@playwright/test';

test.describe('Phase 3B Block 4: Global Methods E2E', () => {
  for (let run = 1; run <= 4; run++) {
    test(`run ${run}: should execute floor and box global methods without error`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });

      await page.goto('/');

      await page.evaluate(() => {
        if (window.editor) {
          window.editor.setValue('floor("#202030"); [bvh("deep_breath").box(3).trail(30)]');
        }
      });

      const bvhRequest = page.waitForResponse(response => response.url().includes('deep_breath.bvh'));

      const runAllBtn = page.locator('#runAllBtn');
      await runAllBtn.click();

      await bvhRequest;

      const errorToast = page.locator('#error-toast');
      await expect(errorToast).not.toHaveClass(/visible/);
      expect(errors).toEqual([]);
    });
  }
});
