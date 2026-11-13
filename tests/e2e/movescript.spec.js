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

  test('should open help sidebar and insert commands into CodeMirror', async ({ page }) => {
    await page.goto('/');

    const toggleBtn = page.locator('#help-toggle');
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn).toHaveText('?');

    await toggleBtn.click();
    await expect(page.locator('#help-sidebar')).toHaveClass(/abierto/);
    await expect(toggleBtn).toHaveText('X');

    // Click a help item to insert BVH code
    const helpItem = page.locator('.help-item').first();
    await helpItem.click();

    // Evaluate that CodeMirror holds the inserted value
    const editorValue = await page.evaluate(() => window.editor.getValue());
    expect(editorValue).toContain('[bvh("dummy")]');
  });

  test('should allow typing code in CodeMirror and toggling the save state', async ({ page }) => {
    await page.goto('/');

    const editor = page.locator('.CodeMirror').first();
    await editor.click();

    // Set editor value using evaluate for reliability or write to CodeMirror
    await page.evaluate(() => window.editor.setValue('[bvh("dummy")]'));

    const editorValueBefore = await page.evaluate(() => window.editor.getValue());
    expect(editorValueBefore).toBe('[bvh("dummy")]');

    // Trigger save using ctrl+s key combination
    await page.keyboard.press('Control+s');

    // Verify layout or save status
    const isSaved = await page.evaluate(() => {
      // Find sandbox object representing this sandbox
      // and assert that its isSaved property or saved class behaves correctly.
      return document.querySelector('.sb-tab').classList.contains('dirty');
    });
    // It should not be dirty after saving (it's saved)
    expect(isSaved).toBe(false);
  });
});
