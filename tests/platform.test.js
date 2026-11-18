import test from 'node:test';
import assert from 'node:assert';
import { getPlatform } from '../src/platform/platform.js';

test('Platform selection - web profile', async () => {
  global.__MS_PROFILE__ = 'web';
  const platformModule = await getPlatform();
  assert.strictEqual(platformModule.capabilities.localBvh, false);
});
