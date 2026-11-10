import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import { Sandbox } from '../src/ui/sandbox.js';

test('Sandbox UI - lifecycle, saving and pause', () => {
    const sb = new Sandbox('test-sb-1', 1, { code: '[bvh("walk")]' });
    assert.strictEqual(sb.id, 'test-sb-1');
    assert.strictEqual(sb.label, 1);
    assert.strictEqual(sb.cm.getValue(), '[bvh("walk")]');

    // Test saving
    assert.strictEqual(sb.isSaved, false);
    sb.toggleSave();
    assert.strictEqual(sb.isSaved, true);
    assert.strictEqual(sb.hasStored, true);

    // Test local pause
    assert.strictEqual(sb.paused, false);
    sb.setPaused(true);
    assert.strictEqual(sb.paused, true);
    sb.togglePause();
    assert.strictEqual(sb.paused, false);

    // Test cleanup
    assert.doesNotThrow(() => sb.destroy());
});
