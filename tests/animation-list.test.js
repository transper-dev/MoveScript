import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import { initAnimationList } from '../src/ui/animationList.js';

test('AnimationList UI - error on multiple continuous blocks', async () => {
  global.fetch = async () => ({
    ok: true,
    json: async () => ["deep_breath"]
  });

  document.body.innerHTML = `
    <div id="bvh-list"></div>
    <iframe id="preview"></iframe>
  `;

  let setValueCalled = false;
  let errorShown = null;

  global.window.editor = {
    getValue: () => '[bvh("a")]; [bvh("b")]',
    setValue: () => { setValueCalled = true; },
    focus: () => {}
  };
  global.window.showError = (msg) => { errorShown = msg; };

  await initAnimationList();
  const bvhList = document.getElementById('bvh-list');
  const items = bvhList.querySelectorAll('.bvh-item');

  items[0].click();

  assert.ok(errorShown && errorShown.includes('Solo se permite una secuencia continua'), 'Should show error message');
  assert.strictEqual(setValueCalled, false, 'setValue should NOT be called');

  delete global.window.showError;
});

test('AnimationList UI - setCursor and focus called before runActiveSandbox', async () => {
  global.fetch = async () => ({
    ok: true,
    json: async () => ["deep_breath"]
  });

  document.body.innerHTML = `
    <div id="bvh-list"></div>
    <iframe id="preview"></iframe>
  `;

  const callOrder = [];
  global.window.editor = {
    getValue: () => '',
    setValue: () => { callOrder.push('setValue'); },
    posFromIndex: (i) => i,
    setCursor: () => { callOrder.push('setCursor'); },
    focus: () => { callOrder.push('focus'); }
  };
  global.window.runActiveSandbox = () => { callOrder.push('runActiveSandbox'); };

  await initAnimationList();
  const bvhList = document.getElementById('bvh-list');
  const items = bvhList.querySelectorAll('.bvh-item');

  items[0].click();

  assert.deepStrictEqual(callOrder, ['setValue', 'setCursor', 'focus', 'runActiveSandbox']);
});

test('AnimationList UI - render animations, hover, click, error handling and fallback', async () => {
  let fetched = false;
  global.fetch = async (url) => {
    fetched = true;
    return {
      ok: true,
      json: async () => ["deep_breath", "dummy", "flapping_wings"]
    };
  };

  document.body.innerHTML = `
    <div id="bvh-list"></div>
    <iframe id="preview"></iframe>
    <div id="hover-preview-container">
      <img id="hover-preview-image" src="" />
    </div>
    <div id="error-toast"><span id="error-text"></span></div>
  `;

  let editorValue = '';
  global.window.editor = {
    getValue: () => editorValue,
    setValue: (v) => { editorValue = v; },
    focus: () => {},
    posFromIndex: (i) => i,
    setCursor: () => {}
  };
  global.window.runActiveSandbox = () => {};

  let errorShown = null;
  global.window.showError = (msg) => { errorShown = msg; };

  await initAnimationList();
  assert.strictEqual(fetched, true);

  const bvhList = document.getElementById('bvh-list');
  const items = bvhList.querySelectorAll('.bvh-item');
  assert.strictEqual(items.length, 2); // 'dummy' filtered out
  assert.strictEqual(items[0].textContent, 'deep_breath');

  // Test Hover / Mousemove / Mouseleave
  const container = document.getElementById('hover-preview-container');
  const img = document.getElementById('hover-preview-image');

  items[0].dispatchEvent(new global.window.MouseEvent('mouseenter'));
  assert.strictEqual(items[0].querySelector('span').textContent, 'ADD deep_breath');
  assert.strictEqual(container.classList.contains('visible'), true);
  assert.ok(img.src.endsWith('deep_breath.gif'));

  // Test onerror of img
  img.onerror();
  assert.strictEqual(container.classList.contains('visible'), false);

  items[0].dispatchEvent(new global.window.MouseEvent('mousemove', { clientX: 100, clientY: 300 }));
  items[0].dispatchEvent(new global.window.MouseEvent('mouseleave'));
  assert.strictEqual(items[0].querySelector('span').textContent, 'deep_breath');
  assert.strictEqual(container.classList.contains('visible'), false);

  // Test Click insertion (success)
  items[0].click();
  assert.strictEqual(editorValue, '[bvh("deep_breath")]');

  delete global.window.showError;
});

test('AnimationList UI - fallback on fetch error / empty list', async () => {
  let errorLogged = null;
  const origError = console.error;
  console.error = (msg) => { errorLogged = msg; };

  global.fetch = async () => ({ ok: false });
  document.body.innerHTML = `<div id="bvh-list"></div><iframe id="preview"></iframe>`;

  await initAnimationList();
  assert.strictEqual(errorLogged, 'Cargando animaciones de emergencia.');
  console.error = origError;
});
