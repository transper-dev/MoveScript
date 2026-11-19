import test from 'node:test';
import assert from 'node:assert';
import { platform } from '../src/platform/web/index.js';

test('Platform web - resolveUrl subfolders and validation', async () => {
  const url1 = await platform.bvh.resolveUrl('extras/monster_walk');
  assert.strictEqual(url1, './assets/bvh/extras/monster_walk.bvh');

  const url2 = await platform.bvh.resolveUrl('advanced/steps');
  assert.strictEqual(url2, './assets/bvh/advanced/steps.bvh');

  await assert.rejects(async () => {
    await platform.bvh.resolveUrl('../x');
  }, /inválido/);

  await assert.rejects(async () => {
    await platform.bvh.resolveUrl('a/b/c');
  }, /inválido/);

  await assert.rejects(async () => {
    await platform.bvh.resolveUrl('http://x/y');
  }, /no permitido en la versión web/);

  await assert.rejects(async () => {
    await platform.bvh.resolveUrl('a\\b');
  }, /inválido/);
});
