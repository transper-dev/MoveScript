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
        sceneMod.floor("#111111", 1000);
        assert.ok(sceneMod.scene.children.some(c => c.name === "CustomFloor"), "Floor should be added to scene");
        sceneMod.clearFloor();
        assert.ok(!sceneMod.scene.children.some(c => c.name === "CustomFloor"), "Floor should be removed from scene");

        sceneMod.setCam(10, 10, 10, 0, 0, 0);
        sceneMod.setBackground("#ffffff");
        sceneMod.setRot(1);
    });

    // Reset
    sceneMod.setGlobalPause(false);
});
