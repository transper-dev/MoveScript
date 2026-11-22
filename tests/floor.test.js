import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import { buildApi } from '../src/engine/api.js';

test('API - floor method is defined and executes correctly', () => {
  const ctx = { params: {}, clear: () => {} };
  const api = buildApi(ctx);
  assert.strictEqual(typeof api.floor, 'function');
  assert.strictEqual(api.floor('#ff0000', 500), api);
});
