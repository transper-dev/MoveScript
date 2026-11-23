import test from 'node:test';
import assert from 'node:assert';
import { capabilities } from '../src/platform/index.js';

test('Platform capabilities for desktop environment', () => {
    // In our test environment, capabilities defaults to web, but let's test desktop capabilities structure
    assert.strictEqual(typeof capabilities.isWeb, 'boolean');
    assert.strictEqual(typeof capabilities.isDesktop, 'boolean');
    assert.strictEqual(typeof capabilities.hasLocalBvh, 'boolean');
});
