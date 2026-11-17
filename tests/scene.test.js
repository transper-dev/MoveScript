import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import * as sceneMod from '../src/engine/scene.js';

test('Engine Scene - Global configurations', () => {
    // Check initial values
    assert.strictEqual(sceneMod.globalPause, false);

    sceneMod.setGlobalPause(true);
    assert.strictEqual(sceneMod.globalPause, true);

    // Smoke tests for setters
    assert.doesNotThrow(() => {
        sceneMod.setGrid(100, 10);
        sceneMod.setCam(10, 10, 10, 0, 0, 0);
        sceneMod.setBackground("#ffffff");
        sceneMod.setRot(1);
    });

    // Reset
    sceneMod.setGlobalPause(false);
});
