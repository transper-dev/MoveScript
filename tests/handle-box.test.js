import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import * as THREE from 'three';
import { createBvh, sharedUnitEdgesGeometry } from '../src/engine/bvh.js';
import { SandboxContext } from '../src/engine/context.js';
import { buildApi, executeInSandbox } from '../src/engine/api.js';
import { scene } from '../src/engine/scene.js';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
import { waitFor } from './helpers.js';

test('box: n cajas creadas por createBvh', async () => {
  const ctx = new SandboxContext('bvh-box-real', 0, buildApi);
  const handle = createBvh(ctx, 'anim1').box(3, 0.2);

  await waitFor(() => ctx.rigs.find(r => r.handle === handle));

  const rig = ctx.rigs.find(r => r.handle === handle);
  assert.ok(rig, 'Rig should be loaded via mock BVHLoader');
  assert.strictEqual(rig.boxes.length, 3, 'Rig should have exactly 3 boxes created by bvh.js');
});

test('box: handle.box(1e9) -> 30, "x" y NaN -> 0; dist acotado a [0,10]', () => {
  const ctx = new SandboxContext('bvh-box-limits', 0, buildApi);
  const handle = createBvh(ctx, 'anim1');

  handle.box(1e9, 20);
  assert.strictEqual(handle._boxesCount, 30);
  assert.strictEqual(handle._boxDist, 10);

  handle.box('x', NaN);
  assert.strictEqual(handle._boxesCount, 0);
  assert.strictEqual(handle._boxDist, 0);

  handle.box(NaN, -5);
  assert.strictEqual(handle._boxesCount, 0);
  assert.strictEqual(handle._boxDist, 0);
});

test('box: todas las cajas comparten la misma EdgesGeometry', async () => {
  const ctx = new SandboxContext('bvh-box-shared-geom', 0, buildApi);
  const handle = createBvh(ctx, 'anim1').box(4);

  await waitFor(() => ctx.rigs.find(r => r.handle === handle));

  const rig = ctx.rigs.find(r => r.handle === handle);
  assert.ok(rig && rig.boxes.length === 4);
  for (const b of rig.boxes) {
    assert.ok(b.geometry === sharedUnitEdgesGeometry, 'Should share EdgesGeometry');
  }
});

test('box: las cajas creadas por bvh.js tienen parent === scene (no group)', async () => {
  const ctx = new SandboxContext('bvh-box-parent', 0, buildApi);
  const handle = createBvh(ctx, 'anim1').box(2);

  await waitFor(() => ctx.rigs.find(r => r.handle === handle));

  const rig = ctx.rigs.find(r => r.handle === handle);
  assert.ok(rig && rig.boxes.length === 2);
  for (const b of rig.boxes) {
    assert.ok(b.parent === scene, 'Parent must be scene');
    assert.ok(b.parent !== rig.group, 'Parent must not be rig.group');
  }
});

test('box: relevo de cadena: al terminar el primer rig sus cajas se ocultan y las del siguiente se muestran', async () => {
  const ctx = new SandboxContext('bvh-box-chain', 0, buildApi);
  const h1 = createBvh(ctx, 'anim1').box(2);
  const h2 = h1.nextBvh('anim2').box(2);

  await waitFor(() => ctx.rigs.length >= 2);

  const rig1 = ctx.rigs.find(r => r.handle === h1);
  const rig2 = ctx.rigs.find(r => r.handle === h2);
  assert.ok(rig1 && rig2);

  // Initial state: rig1 visible, rig2 not
  ctx.tick(0.016);
  assert.strictEqual(rig1.boxes[0].visible, true);
  assert.strictEqual(rig2.boxes[0].visible, false);

  // Trigger finished on rig1 to do relevo
  rig1.mixer.dispatchEvent({ type: 'finished' });

  ctx.tick(0.016);
  assert.strictEqual(rig1.boxes[0].visible, false);
  assert.strictEqual(rig2.boxes[0].visible, true);
});

test('box: [bvh("deep_breath").box(3)] con executeInSandbox y mock deja rig.boxes.length === 3', async () => {
  const ctx = new SandboxContext('bvh-box-exec', 0, buildApi);
  executeInSandbox(ctx, 'CHAIN($B().bvh("deep_breath").box(3))');

  await waitFor(() => ctx.rigs.length > 0);

  const rig = ctx.rigs[0];
  assert.ok(rig);
  assert.strictEqual(rig.boxes.length, 3);
});

test('box: dos sandboxes no se mezclan (cada uno con sus cajas)', async () => {
  const ctx1 = new SandboxContext('sb1', 0, buildApi);
  const ctx2 = new SandboxContext('sb2', 1, buildApi);

  const h1 = createBvh(ctx1, 'anim1').box(2);
  const h2 = createBvh(ctx2, 'anim2').box(5);

  await waitFor(() => ctx1.rigs.find(r => r.handle === h1) && ctx2.rigs.find(r => r.handle === h2));

  const rig1 = ctx1.rigs.find(r => r.handle === h1);
  const rig2 = ctx2.rigs.find(r => r.handle === h2);
  assert.ok(rig1 && rig2);

  assert.strictEqual(rig1.boxes.length, 2);
  assert.strictEqual(rig2.boxes.length, 5);
  for (const b of rig1.boxes) {
    assert.ok(!rig2.boxes.includes(b), 'Boxes should not mix');
  }
});

test('box: estabilidad - tamaño igual en tick 2 y 120, finito y > 0 con 3 huesos', async () => {
  const ctx = new SandboxContext('box-stability-bones', 0, buildApi);
  const origLoad = BVHLoader.prototype.load;

  const b1 = new THREE.Bone();
  b1.position.set(0, 0, 0);
  const b2 = new THREE.Bone();
  b2.position.set(10, 20, 0);
  const b3 = new THREE.Bone();
  b3.position.set(20, 50, 30);
  b1.add(b2);
  b2.add(b3);

  BVHLoader.prototype.load = function(url, onLoad) {
    setTimeout(() => {
      onLoad({
        skeleton: { bones: [b1, b2, b3] },
        clip: new THREE.AnimationClip('test', 1, [])
      });
    }, 0);
  };

  const handle = createBvh(ctx, 'anim1').box(2, 0.5);
  await waitFor(() => ctx.rigs.find(r => r.handle === handle));
  BVHLoader.prototype.load = origLoad;

  const rig = ctx.rigs.find(r => r.handle === handle);
  assert.ok(rig);

  scene.updateMatrixWorld(true);
  rig.helper.updateMatrixWorld(true);

  ctx.tick(0.016);
  ctx.tick(0.016);
  const outerTick2 = rig.boxes[1].scale.clone();

  for (let i = 0; i < 118; i++) {
    ctx.tick(0.016);
  }
  const outerTick120 = rig.boxes[1].scale.clone();

  assert.strictEqual(outerTick2.x, outerTick120.x);
  assert.strictEqual(outerTick2.y, outerTick120.y);
  assert.strictEqual(outerTick2.z, outerTick120.z);
  assert.ok(isFinite(outerTick2.x));
  assert.ok(outerTick2.x > 0);
});

test('box: variante _useDummy y group.scale = 100 coincide con bounding box estricto', async () => {
  const ctx = new SandboxContext('box-dummy-scale', 0, buildApi);
  const origLoad = BVHLoader.prototype.load;

  const b1 = new THREE.Bone();
  b1.position.set(0, 0, 0);
  const b2 = new THREE.Bone();
  b2.position.set(1, 2, 1);
  b1.add(b2);

  BVHLoader.prototype.load = function(url, onLoad) {
    setTimeout(() => {
      onLoad({
        skeleton: { bones: [b1, b2] },
        clip: new THREE.AnimationClip('test', 1, [])
      });
    }, 0);
  };

  const handle = createBvh(ctx, 'anim1').dummy().box(1, 0);
  await waitFor(() => ctx.rigs.find(r => r.handle === handle));
  BVHLoader.prototype.load = origLoad;

  const rig = ctx.rigs.find(r => r.handle === handle);
  assert.ok(rig);

  rig.group.scale.set(100, 100, 100);
  scene.updateMatrixWorld(true);
  rig.group.updateMatrixWorld(true);

  ctx.tick(0.016);

  const strictBox = new THREE.Box3().setFromObject(rig.group);
  const strictSize = new THREE.Vector3();
  strictBox.getSize(strictSize);

  assert.strictEqual(Math.round(rig.boxes[0].scale.x), Math.round(strictSize.x));
  assert.strictEqual(Math.round(rig.boxes[0].scale.y), Math.round(strictSize.y));
  assert.strictEqual(Math.round(rig.boxes[0].scale.z), Math.round(strictSize.z));
});
