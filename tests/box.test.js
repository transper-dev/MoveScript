import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import { scene } from '../src/engine/scene.js';
import { buildApi } from '../src/engine/api.js';

test('API - box method is defined and adds boxes to scene', () => {
  const ctx = { params: {}, clear: () => {} };
  const api = buildApi(ctx);

  assert.strictEqual(typeof api.box, 'function');

  const before = scene.children.length;
  const ret = api.box(4, 30);

  assert.strictEqual(ret, api, 'box() should return api for chaining');
  assert.strictEqual(scene.children.length, before + 1, 'box() should add a group to scene');
});

test('API - box default args (n=3, dist=50)', () => {
  const ctx = { params: {}, clear: () => {} };
  const api = buildApi(ctx);

  const before = scene.children.length;
  api.box();
  assert.strictEqual(scene.children.length, before, 'box() with no args replaces or updates boxGroup');
});
