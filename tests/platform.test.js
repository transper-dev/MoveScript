import test from 'node:test';
import assert from 'node:assert';
import { capabilities, getPlatformInfo } from '../src/platform/index.js';
import { capabilities as desktopCaps } from '../src/platform/desktop.js';
import { sanitizeBvhFileName } from '../electron/validator.js';

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

test('Platform capabilities for desktop', () => {
    assert.strictEqual(desktopCaps.isWeb, false);
    assert.strictEqual(desktopCaps.isDesktop, true);
    assert.strictEqual(desktopCaps.hasLocalBvh, true);
    assert.strictEqual(desktopCaps.hasVrTunnel, true);
    assert.strictEqual(desktopCaps.hasOsc, true);
});

test('BvhFileName Security Validation', () => {
    // Casos válidos
    assert.strictEqual(sanitizeBvhFileName('walk'), 'walk.bvh');
    assert.strictEqual(sanitizeBvhFileName('walk.bvh'), 'walk.bvh');
    assert.strictEqual(sanitizeBvhFileName('dance_01-fast'), 'dance_01-fast.bvh');

    // Casos inválidos y Path Traversal
    assert.throws(() => sanitizeBvhFileName(''), /Invalid file name/);
    assert.throws(() => sanitizeBvhFileName(null), /Invalid file name/);
    assert.throws(() => sanitizeBvhFileName('../secret'), /Path traversal/);
    assert.throws(() => sanitizeBvhFileName('folder/walk'), /Path traversal/);
    assert.throws(() => sanitizeBvhFileName('folder\\walk'), /Path traversal/);
    assert.throws(() => sanitizeBvhFileName('walk; rm -rf'), /only alphanumeric/);
});
