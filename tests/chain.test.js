import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import * as THREE from 'three';
import { createBvh } from '../src/engine/bvh.js';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
import { waitFor } from './helpers.js';

test('BVH Chain - relay logic', async (t) => {
    const ctx = {
        runId: 1,
        bvhCounter: 0,
        rigs: [],
        params: { speed: 1, globalScale: 1, showSkeleton: true },
        later: (fn, ms) => setTimeout(fn, ms),
        defaultX: 0
    };

    const mockResult = {
        skeleton: { bones: [new THREE.Bone()] },
        clip: new THREE.AnimationClip('test', 1, [])
    };

    const originalLoad = BVHLoader.prototype.load;
    const loadCallbacks = [];
    BVHLoader.prototype.load = function(url, onLoad) {
        loadCallbacks.push(onLoad);
    };

    try {
        const handle1 = createBvh(ctx, 'anim1');
        const handle2 = handle1.nextBvh('anim2');

        await waitFor(() => loadCallbacks.length >= 2);
        assert.strictEqual(loadCallbacks.length, 2, 'Two loader calls should have been made');

        loadCallbacks[0](mockResult);
        assert.strictEqual(ctx.rigs.length, 1, 'One rig should be loaded');
        const rig1 = ctx.rigs[0];

        loadCallbacks[1](mockResult);
        assert.strictEqual(ctx.rigs.length, 2, 'Two rigs should be loaded');
        const rig2 = ctx.rigs[1];

        rig1.mixer.dispatchEvent({ type: 'finished' });

        assert.strictEqual(rig2.action.paused, false, 'Rig2 should be playing after Rig1 finishes');

    } finally {
        BVHLoader.prototype.load = originalLoad;
    }
});
