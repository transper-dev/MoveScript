import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import { initAnimationList } from '../src/ui/animationList.js';

test('AnimationList UI - render animations and click insertion', async () => {
  document.body.innerHTML = `
    <div id="bvh-list"></div>
    <iframe id="preview"></iframe>
  `;

  let editorValue = '';
  global.window.editor = {
    getValue: () => editorValue,
    setValue: (v) => { editorValue = v; },
    focus: () => {}
  };
  global.window.runActiveSandbox = () => {};

  // Mock fetch for lista.json
  global.fetch = async (url) => ({
    ok: true,
    json: async () => ['turn', 'silly_walk', 'dummy']
  });

  await initAnimationList();

  const bvhList = document.getElementById('bvh-list');
  const items = bvhList.querySelectorAll('.bvh-item');

  // 'dummy' should be filtered out, leaving 'turn' and 'silly_walk'
  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[0].textContent, 'turn');

  // Click first animation
  items[0].click();
  assert.strictEqual(editorValue, '[bvh("turn")]');
});
