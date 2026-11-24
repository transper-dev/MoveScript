import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import { initDrawer } from '../src/ui/drawer.js';

test('Drawer UI - toggle open and close', () => {
  document.body.innerHTML = `
    <div id="bvh-drawer">
      <div id="drawer-toggle"><i class="fas fa-chevron-up"></i></div>
    </div>
    <div id="desktop-controls"></div>
  `;

  const drawer = document.getElementById('bvh-drawer');
  Object.defineProperty(drawer, 'offsetHeight', { configurable: true, value: 240 });
  initDrawer();

  const toggleBtn = document.getElementById('drawer-toggle');
  const icon = toggleBtn.querySelector('i');

  const desktopControls = document.getElementById('desktop-controls');
  assert.strictEqual(drawer.classList.contains('abierto'), false);

  toggleBtn.click();
  assert.strictEqual(drawer.classList.contains('abierto'), true);
  assert.strictEqual(icon.className, 'fas fa-chevron-down');
  assert.strictEqual(desktopControls.style.bottom, '260px');

  toggleBtn.click();
  assert.strictEqual(drawer.classList.contains('abierto'), false);
  assert.strictEqual(icon.className, 'fas fa-chevron-up');
  assert.strictEqual(desktopControls.style.bottom, '20px');
});

test('Drawer UI - missing elements warning branch', () => {
  document.body.innerHTML = `<div></div>`;
  assert.doesNotThrow(() => initDrawer());
});
