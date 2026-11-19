import test from 'node:test';
import assert from 'node:assert';
import './setup.js';

test('Platform selection - web profile', async () => {
  global.__MS_PROFILE__ = 'web';
  // Reset module cache by reimporting (platform caches, so we test the result of the cached call)
  const { getPlatform } = await import('../src/platform/platform.js');
  const p = await getPlatform();
  assert.strictEqual(p.capabilities.localBvh, false);
});

test('Platform desktop - capabilities are correct', async () => {
  const { capabilities } = await import('../src/platform/desktop/index.js');
  assert.strictEqual(capabilities.localBvh, true);
  assert.strictEqual(capabilities.autoUpdate, true);
});

test('Platform desktop - resolveUrl throws without window.movescriptDesktop', async () => {
  const { bvh } = await import('../src/platform/desktop/index.js');
  if (global.window) global.window.movescriptDesktop = undefined;
  await assert.rejects(
    async () => bvh.resolveUrl('turn'),
    /movescriptDesktop/
  );
});

test('Platform desktop - resolveUrl delegates with mock present', async () => {
  const { bvh } = await import('../src/platform/desktop/index.js');
  global.window.movescriptDesktop = {
    bvh: { resolveUrl: async (name) => `/local/${name}.bvh` }
  };
  const url = await bvh.resolveUrl('turn');
  assert.strictEqual(url, '/local/turn.bvh');
  global.window.movescriptDesktop = undefined;
});
