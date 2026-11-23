import test from 'node:test';
import assert from 'node:assert';
import { capabilities as desktopCaps } from '../src/platform/desktop.js';
import { capabilities as webCaps } from '../src/platform/web.js';

test('Desktop capabilities enforce local bvh and tools', () => {
    assert.strictEqual(desktopCaps.hasLocalBvh, true);
    assert.strictEqual(desktopCaps.isDesktop, true);
});

test('Web capabilities restrict local features', () => {
    assert.strictEqual(webCaps.hasLocalBvh, false);
    assert.strictEqual(webCaps.isWeb, true);
});
