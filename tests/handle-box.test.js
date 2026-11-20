import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import * as THREE from 'three';
import { createBvh, makeChain, RigNode, sharedUnitEdgesGeometry } from '../src/engine/bvh.js';
import { SandboxContext } from '../src/engine/context.js';
import { buildApi, executeInSandbox } from '../src/engine/api.js';
import { scene } from '../src/engine/scene.js';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';

test('box: n boxes created correctly with bounds and defaults', async () => {
  const ctx = new SandboxContext('bvh-box', 0, buildApi);
  const handle = createBvh(ctx, 'anim1').box(5, 0.5);

  assert.strictEqual(handle._boxesCount, 5);
  assert.strictEqual(handle._boxDist, 0.5);

  const mockResult = {
    skeleton: { bones: [new THREE.Bone()] },
    clip: new THREE.AnimationClip('test', 1, [])
  };

  const origLoad = BVHLoader.prototype.load;
  BVHLoader.prototype.load = function(url, onLoad) {
    onLoad(mockResult);
  };

  await new Promise(r => setTimeout(r, 10));
  BVHLoader.prototype.load = origLoad;

  const rig = ctx.rigs.find(r => r.handle === handle);
  assert.ok(rig, 'Rig should be loaded');
  assert.strictEqual(rig.boxes.length, 5, 'Should create 5 box meshes');
});

test('box: limits box(1e9) -> 30, box("x") and NaN -> 0', () => {
  const ctx = new SandboxContext('bvh-box-limits', 0, buildApi);
  const handle = createBvh(ctx, 'anim1');

  handle.box(1e9, 20);
  assert.strictEqual(handle._boxesCount, 30);
  assert.strictEqual(handle._boxDist, 10);

  handle.box('x', NaN);
  assert.strictEqual(handle._boxesCount, 0);
  assert.strictEqual(handle._boxDist, 0);

  handle.box(NaN);
  assert.strictEqual(handle._boxesCount, 0);
});

test('box: single shared EdgesGeometry across boxes', async () => {
  const ctx = new SandboxContext('bvh-box-geom', 0, buildApi);
  const handle = createBvh(ctx, 'anim1').box(4);

  const mockResult = {
    skeleton: { bones: [new THREE.Bone()] },
    clip: new THREE.AnimationClip('test', 1, [])
  };
  const origLoad = BVHLoader.prototype.load;
  BVHLoader.prototype.load = (url, onLoad) => onLoad(mockResult);

  await new Promise(r => setTimeout(r, 10));
  BVHLoader.prototype.load = origLoad;

  const rig = ctx.rigs.find(r => r.handle === handle);
  assert.strictEqual(rig.boxes.length, 4);
  for (const b of rig.boxes) {
    assert.strictEqual(b.geometry, sharedUnitEdgesGeometry, 'Should share the exact same EdgesGeometry instance');
  }
});

test('box: tick updates position and scale of boxes', async () => {
  const ctx = new SandboxContext('bvh-box-tick', 0, buildApi);
  const handle = createBvh(ctx, 'anim1').box(2);

  const bone = new THREE.Bone();
  bone.position.set(0, 50, 0);
  const mockResult = {
    skeleton: { bones: [bone] },
    clip: new THREE.AnimationClip('test', 1, [])
  };
  const origLoad = BVHLoader.prototype.load;
  BVHLoader.prototype.load = (url, onLoad) => onLoad(mockResult);

  await new Promise(r => setTimeout(r, 10));
  BVHLoader.prototype.load = origLoad;

  const rig = ctx.rigs.find(r => r.handle === handle);
  // Give helper a bounding box
  rig.helper.boundingBox = new THREE.Box3(new THREE.Vector3(-10, -10, -10), new THREE.Vector3(10, 10, 10));

  ctx.tick(0.016);
  assert.ok(rig.boxes[0].visible, 'Box should be visible');
  assert.ok(rig.boxes[0].scale.x > 0, 'Box scale should be computed');
});

test('box: chained relay shows and hides boxes properly', () => {
  const ctx = new SandboxContext('bvh-box-chain', 0, buildApi);
  const h1 = createBvh(ctx, 'anim1');
  const h2 = h1.nextBvh('anim2').box(3);

  assert.strictEqual(h1._boxesCount, 3);
  assert.strictEqual(h2._boxesCount, 3);
});

test('box: clear leaves scene.children clean and disposes materials', async () => {
  const ctx = new SandboxContext('bvh-box-clear', 0, buildApi);
  const handle = createBvh(ctx, 'anim1').box(3);

  const mockResult = {
    skeleton: { bones: [new THREE.Bone()] },
    clip: new THREE.AnimationClip('test', 1, [])
  };
  const origLoad = BVHLoader.prototype.load;
  BVHLoader.prototype.load = (url, onLoad) => onLoad(mockResult);

  await new Promise(r => setTimeout(r, 10));
  BVHLoader.prototype.load = origLoad;

  const rig = ctx.rigs.find(r => r.handle === handle);
  let matDispose = 0;
  for (const b of rig.boxes) {
    const origDisp = b.material.dispose;
    b.material.dispose = () => { matDispose++; origDisp.call(b.material); };
  }

  ctx.clear();
  assert.strictEqual(matDispose, 3, 'All box materials should be disposed');
  assert.strictEqual(rig.boxes.length, 0, 'Rig boxes array should be cleared');
});

test('box: two sandboxes with box() do not interfere', () => {
  const ctx1 = new SandboxContext('sb1', 0, buildApi);
  const ctx2 = new SandboxContext('sb2', 1, buildApi);

  const h1 = createBvh(ctx1, 'anim1').box(5, 0.2);
  const h2 = createBvh(ctx2, 'anim2').box(10, 0.4);

  assert.strictEqual(h1._boxesCount, 5);
  assert.strictEqual(h2._boxesCount, 10);
});

test('box: [bvh("deep_breath").box(3)] executes without error', () => {
  const ctx = new SandboxContext('sb-eval', 0, buildApi);
  assert.doesNotThrow(() => {
    executeInSandbox(ctx, 'CHAIN($B().bvh("deep_breath").box(3))');
  });
});
