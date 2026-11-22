import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import * as THREE from 'three';
import { SandboxContext } from '../src/engine/context.js';
import { buildApi } from '../src/engine/api.js';
import { scene } from '../src/engine/scene.js';
import { incrementFrameCount, frameCount } from '../src/engine/utils.js';
import { createBvh } from '../src/engine/bvh.js';

function makeRig(ctx, trailLen = 5) {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0, 1,1,1]), 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const helper = new THREE.LineSegments(geom, mat);
  helper.visible = true;
  helper.matrixWorld = new THREE.Matrix4();

  return {
    ctx,
    handle: { _useDummy: false, _isChained: false },
    opts: { trail: trailLen, delay: 0 },
    helper,
    root: {},
    group: new THREE.Group(),
    mixer: { stopAllAction: () => {}, uncacheRoot: () => {}, update: () => {}, timeScale: 1 },
    timeAlive: 1,
    autoScale: 1,
    _trailPool: []
  };
}

test('trail: un snapshot consume una malla del pool sin geometry.clone', () => {
  const ctx = new SandboxContext('pool-test-reuse', 0, buildApi);
  const rig = makeRig(ctx, 10);
  ctx.rigs.push(rig);

  const mockGeom = new THREE.BufferGeometry();
  mockGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0, 0,0,0]), 3));
  let cloneCalled = false;
  mockGeom.clone = () => { cloneCalled = true; return mockGeom; };

  const mockMat = new THREE.LineBasicMaterial();
  const mockMesh = new THREE.LineSegments(mockGeom, mockMat);
  rig._trailPool.push(mockMesh);

  while (frameCount % 6 !== 0) {
    incrementFrameCount();
  }

  ctx.tick(0.016);

  assert.strictEqual(rig._trailPool.length, 0, 'Mesh should be consumed from pool');
  assert.ok(ctx.trails.length === 1, 'One trail should be active');
  assert.ok(ctx.trails[0].mesh === mockMesh, 'The trail should use the pooled mesh');
  assert.strictEqual(cloneCalled, false, 'geometry.clone should not be called');
});

test('trail: dos rigs con colores distintos: cada estela con el color de SU helper', () => {
  const ctx = new SandboxContext('pool-test-colors', 0, buildApi);
  const rig1 = makeRig(ctx, 5);
  rig1.helper.material.color.set(0xff0000);

  const rig2 = makeRig(ctx, 5);
  rig2.helper.material.color.set(0x0000ff);

  ctx.rigs.push(rig1, rig2);

  while (frameCount % 6 !== 0) {
    incrementFrameCount();
  }

  ctx.tick(0.016);

  assert.ok(ctx.trails.length === 2, 'Should create 2 trail segments');
  const t1 = ctx.trails.find(t => t.rig === rig1);
  const t2 = ctx.trails.find(t => t.rig === rig2);

  assert.ok(t1 && t2, 'Both trails exist');
  assert.strictEqual(t1.mesh.material.color.getHex(), 0xff0000, 'Trail 1 color should be red');
  assert.strictEqual(t2.mesh.material.color.getHex(), 0x0000ff, 'Trail 2 color should be blue');
});

test('trail: limites acotados a [0, 600]', () => {
  const ctx = new SandboxContext('pool-test-bounds', 0, buildApi);
  const handle = createBvh(ctx, 'anim1');

  handle.trail(1e9);
  assert.strictEqual(handle._trail, 600, 'handle.trail bounded to 600');

  ctx.api.trail(1e9);
  assert.strictEqual(ctx.params.trail, 600, 'api.trail bounded to 600');
});

test('trail: tope de 2000 estelas activas se respeta', () => {
  const ctx = new SandboxContext('pool-test-max', 0, buildApi);
  const rig = makeRig(ctx, 10);
  ctx.rigs.push(rig);

  for (let i = 0; i < 2000; i++) {
    ctx.trails.push({ mesh: new THREE.LineSegments(), life: 0.6, decay: 0.05, rig });
  }

  while (frameCount % 6 !== 0) {
    incrementFrameCount();
  }

  ctx.tick(0.016);

  assert.strictEqual(ctx.trails.length, 2000, 'Trails should not exceed 2000');
});

test('trail: clear() limpia todo, scene.children y dispone', () => {
  const ctx = new SandboxContext('pool-test-clear', 0, buildApi);
  const rig = makeRig(ctx, 10);
  ctx.rigs.push(rig);

  const initialChildrenCount = scene.children.length;

  while (frameCount % 6 !== 0) {
    incrementFrameCount();
  }
  ctx.tick(0.016);

  assert.ok(scene.children.length > initialChildrenCount, 'Mesh should be added to scene');
  assert.ok(ctx.trails.length === 1, 'One trail should be active');

  ctx.clear();

  assert.strictEqual(ctx.trails.length, 0, 'Active trails cleared');
  assert.strictEqual(scene.children.length, initialChildrenCount, 'Children returned to initial state');
});

test('trail: estela capturada no se mueve con el helper', () => {
  const ctx = new SandboxContext('pool-test-static', 0, buildApi);
  const rig = makeRig(ctx, 10);
  ctx.rigs.push(rig);

  while (frameCount % 6 !== 0) {
    incrementFrameCount();
  }

  rig.helper.matrixWorld.makeTranslation(10, 0, 0);
  ctx.tick(0.016);

  rig.helper.matrixWorld.makeTranslation(20, 0, 0);

  assert.ok(ctx.trails[0].mesh.parent === scene, 'Trail belongs to scene');
});

test('trail: cambia numero de vertices -> recrea geometria', () => {
  const ctx = new SandboxContext('pool-test-vertices', 0, buildApi);
  const rig = makeRig(ctx, 10);
  ctx.rigs.push(rig);

  const geom2 = new THREE.BufferGeometry();
  geom2.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0, 0,0,0]), 3));
  const mesh2 = new THREE.LineSegments(geom2, new THREE.LineBasicMaterial());
  rig._trailPool.push(mesh2);

  const geom4 = new THREE.BufferGeometry();
  geom4.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0, 1,1,1, 2,2,2, 3,3,3]), 3));
  rig.helper.geometry = geom4;

  while (frameCount % 6 !== 0) {
    incrementFrameCount();
  }

  ctx.tick(0.016);

  assert.strictEqual(rig._trailPool.length, 0, 'Pooled mesh should be consumed');
  assert.ok(ctx.trails.length === 1, 'Should capture trail');
  assert.ok(ctx.trails[0].mesh.geometry !== geom2, 'Should have recreated geometry with 4 vertices');
});
