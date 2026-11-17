import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import * as utils from '../src/engine/utils.js';

test('Engine Utils - frameCount', () => {
    const initialCount = utils.frameCount;
    utils.incrementFrameCount();
    assert.strictEqual(utils.frameCount, initialCount + 1);
});

test('Engine Utils - rig selection and disposal', () => {
    // Should be able to call deselect without error
    assert.doesNotThrow(() => utils.deselect(false));

    // Dispose rig smoke test
    const mockRig = {
        mixer: { stopAllAction: () => {}, uncacheRoot: () => {} },
        helper: { geometry: { dispose: () => {} }, material: { dispose: () => {} } },
        group: { traverse: (cb) => { cb({ isMesh: true, geometry: { dispose: () => {} }, material: { dispose: () => {} } }); } }
    };

    assert.doesNotThrow(() => utils.disposeRig(mockRig));
});
