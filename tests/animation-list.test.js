import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import { initAnimationList } from '../src/ui/animationList.js';

test('AnimationList UI - render animations', async () => {
  global.fetch = async (url) => ({
    ok: true,
    json: async () => ["turn", "silly_walk", "dummy"]
  });
  document.body.innerHTML = \<div id="bvh-list"></div><iframe id="preview"></iframe>\;
  
  await initAnimationList();
  const bvhList = document.getElementById('bvh-list');
  const items = bvhList.querySelectorAll('.bvh-item');
  
  assert.strictEqual(items.length, 2); // 'dummy' filtered out
  assert.strictEqual(items[0].textContent, 'turn');
});
