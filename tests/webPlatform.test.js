import test from 'node:test';
import assert from 'node:assert';
import { platform } from '../src/platform/web/index.js';

test('Platform web - resolveUrl valid and invalid', async () => {
  const url = await platform.bvh.resolveUrl('turn');
  assert.strictEqual(url, './assets/bvh/turn.bvh');

  await assert.rejects(async () => {
    await platform.bvh.resolveUrl('../malicious');
  }, /inválido/);
});
