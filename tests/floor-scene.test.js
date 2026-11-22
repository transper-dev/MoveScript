
import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import { scene } from '../src/engine/scene.js';
import { buildApi } from '../src/engine/api.js';

test('API - floor method adds a floor to the scene', () => {
  const ctx = { params: {}, clear: () => {} };
  const api = buildApi(ctx);

  const initialChildrenCount = scene.children.length;
  api.floor('#ff0000', 500);

  assert.strictEqual(scene.children.length, initialChildrenCount + 1, 'Floor mesh should be added to scene');
});
