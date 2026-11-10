import { test, expect } from '@playwright/test';

test.describe('MoveScript E2E Tests', () => {
  test('should load application and render main UI elements', async ({ page }) => {
    await page.goto('/');

    // Check title
    await expect(page).toHaveTitle('MoveScript');

    // Check global control buttons
    const addBtn = page.locator('#addSandboxBtn');
    await expect(addBtn).toBeVisible();

    const runAllBtn = page.locator('#runAllBtn');
    await expect(runAllBtn).toBeVisible();

    // Check CodeMirror editor exists
    const cmEditor = page.locator('.CodeMirror');
    await expect(cmEditor.first()).toBeVisible();
  });

  test('should add a new sandbox window when clicking New window', async ({ page }) => {
    await page.goto('/');

    const initialWindowsCount = await page.locator('#sandboxes > .sandbox').count();

    // Click add sandbox button
    await page.click('#addSandboxBtn');

    // Verify window count increased
    const newWindowsCount = await page.locator('#sandboxes > .sandbox').count();
    expect(newWindowsCount).toBeGreaterThan(initialWindowsCount);
  });

  test('should toggle global pause state', async ({ page }) => {
    await page.goto('/');

    const pauseBtn = page.locator('#globalPauseBtn');
    await expect(pauseBtn).toBeVisible();
    await expect(pauseBtn).not.toHaveClass(/paused/);

    await pauseBtn.click();
    await expect(pauseBtn).toHaveClass(/paused/);
  });
});
