import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import { initDrawer } from '../src/ui/drawer.js';

test('Drawer UI - toggle open and close', () => {
  document.body.innerHTML = `
    <div id="bvh-drawer">
      <div id="drawer-toggle"><i class="fas fa-chevron-up"></i></div>
    </div>
  `;

  initDrawer();

  const drawer = document.getElementById('bvh-drawer');
  const toggleBtn = document.getElementById('drawer-toggle');
  const icon = toggleBtn.querySelector('i');

  assert.strictEqual(drawer.classList.contains('abierto'), false);

  toggleBtn.click();
  assert.strictEqual(drawer.classList.contains('abierto'), true);
  assert.strictEqual(icon.className, 'fas fa-chevron-down');

  toggleBtn.click();
  assert.strictEqual(drawer.classList.contains('abierto'), false);
  assert.strictEqual(icon.className, 'fas fa-chevron-up');
});
