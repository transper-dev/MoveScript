import test from 'node:test';
import assert from 'node:assert';
import { capabilities, getPlatformInfo } from '../src/platform/index.js';

test('Platform capabilities for web', () => {
    assert.strictEqual(capabilities.isWeb, true);
    assert.strictEqual(capabilities.isDesktop, false);
    assert.strictEqual(capabilities.hasLocalBvh, false);
    assert.strictEqual(capabilities.hasVrTunnel, false);
    assert.strictEqual(capabilities.hasOsc, false);

    const info = getPlatformInfo();
    assert.strictEqual(info.name, 'web');
    assert.strictEqual(info.capabilities.isWeb, true);
});
