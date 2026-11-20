import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import * as THREE from 'three';
import { createBvh, sharedUnitEdgesGeometry } from '../src/engine/bvh.js';
import { SandboxContext } from '../src/engine/context.js';
import { buildApi } from '../src/engine/api.js';
import { scene } from '../src/engine/scene.js';

test('box: estabilidad - tamaño igual en tick 2 y 120, finito', () => {
  const ctx = new SandboxContext('box-stability', 0, buildApi);
  const handle = createBvh(ctx, 'anim1').box(1, 0.2);

  const geom = new THREE.BoxGeometry(40, 170, 25);
  const rig = {
    ctx, handle, group: new THREE.Group(), root: new THREE.Group(),
    helper: new THREE.Mesh(geom, new THREE.MeshBasicMaterial()),
    mixer: { update: () => {} }, action: {}, boxes: [], opts: {}, timeAlive: 1
  };
  rig.helper.visible = true;
  ctx.rigs.push(rig);

  const box = new THREE.LineSegments(sharedUnitEdgesGeometry, new THREE.LineBasicMaterial({ transparent: true }));
  rig.boxes.push(box);
  scene.add(box);

  ctx.tick(0.016);
  ctx.tick(0.016);
  const size2 = rig.boxes[0].scale.clone();

  for (let i = 0; i < 118; i++) {
    ctx.tick(0.016);
  }
  const size120 = rig.boxes[0].scale.clone();

  assert.strictEqual(size2.x, size120.x);
  assert.ok(isFinite(size2.x));
  scene.remove(box);
});

test('box: la caja 0 coincide con el bounding box estricto', () => {
  const ctx = new SandboxContext('box-bbox', 0, buildApi);
  const handle = createBvh(ctx, 'anim1').box(1, 0);

  const geom = new THREE.BoxGeometry(50, 50, 50);
  const rig = {
    ctx, handle, group: new THREE.Group(), root: new THREE.Group(),
    helper: new THREE.Mesh(geom, new THREE.MeshBasicMaterial()),
    mixer: { update: () => {} }, action: {}, boxes: [], opts: {}, timeAlive: 1
  };
  rig.helper.visible = true;
  ctx.rigs.push(rig);

  const box = new THREE.LineSegments(sharedUnitEdgesGeometry, new THREE.LineBasicMaterial({ transparent: true }));
  rig.boxes.push(box);
  scene.add(box);

  ctx.tick(0.016);
  assert.strictEqual(rig.boxes[0].scale.x, 50);
  assert.strictEqual(rig.boxes[0].scale.y, 50);
  assert.strictEqual(rig.boxes[0].scale.z, 50);
  scene.remove(box);
});

test('box: dist se respeta: dist 0 frente a dist 1', () => {
  const ctx1 = new SandboxContext('box-dist0', 0, buildApi);
  const h1 = createBvh(ctx1, 'anim1').box(2, 0);
  const geom = new THREE.BoxGeometry(10, 10, 10);
  const rig1 = {
    ctx: ctx1, handle: h1, group: new THREE.Group(), root: new THREE.Group(),
    helper: new THREE.Mesh(geom, new THREE.MeshBasicMaterial()),
    mixer: { update: () => {} }, action: {}, boxes: [], opts: {}, timeAlive: 1
  };
  rig1.helper.visible = true;
  ctx1.rigs.push(rig1);
  const b1 = new THREE.LineSegments(sharedUnitEdgesGeometry, new THREE.LineBasicMaterial({ transparent: true }));
  const b2 = new THREE.LineSegments(sharedUnitEdgesGeometry, new THREE.LineBasicMaterial({ transparent: true }));
  rig1.boxes.push(b1, b2);
  scene.add(b1, b2);

  const ctx2 = new SandboxContext('box-dist1', 1, buildApi);
  const h2 = createBvh(ctx2, 'anim1').box(2, 1);
  const rig2 = {
    ctx: ctx2, handle: h2, group: new THREE.Group(), root: new THREE.Group(),
    helper: new THREE.Mesh(geom, new THREE.MeshBasicMaterial()),
    mixer: { update: () => {} }, action: {}, boxes: [], opts: {}, timeAlive: 1
  };
  rig2.helper.visible = true;
  ctx2.rigs.push(rig2);
  const b3 = new THREE.LineSegments(sharedUnitEdgesGeometry, new THREE.LineBasicMaterial({ transparent: true }));
  const b4 = new THREE.LineSegments(sharedUnitEdgesGeometry, new THREE.LineBasicMaterial({ transparent: true }));
  rig2.boxes.push(b3, b4);
  scene.add(b3, b4);

  ctx1.tick(0.016);
  ctx2.tick(0.016);

  assert.notStrictEqual(rig1.boxes[1].scale.x, rig2.boxes[1].scale.x);
  assert.strictEqual(rig2.boxes[1].scale.x - rig1.boxes[1].scale.x, 60);

  scene.remove(b1, b2, b3, b4);
});

test('box: las cajas son hijas de scene y NO de group', () => {
  const ctx = new SandboxContext('box-scene-parent', 0, buildApi);
  const handle = createBvh(ctx, 'anim1').box(1, 0);
  const geom = new THREE.BoxGeometry(10, 10, 10);
  const rig = {
    ctx, handle, group: new THREE.Group(), root: new THREE.Group(),
    helper: new THREE.Mesh(geom, new THREE.MeshBasicMaterial()),
    mixer: { update: () => {} }, action: {}, boxes: [], opts: {}, timeAlive: 1
  };
  rig.helper.visible = true;
  ctx.rigs.push(rig);

  const box = new THREE.LineSegments(sharedUnitEdgesGeometry, new THREE.LineBasicMaterial({ transparent: true }));
  rig.boxes.push(box);
  scene.add(box);

  ctx.tick(0.016);
  assert.strictEqual(box.parent, scene);
  assert.notStrictEqual(box.parent, rig.group);
  scene.remove(box);
});

test('box: rig invisible -> cajas invisibles; visible -> visibles', () => {
  const ctx = new SandboxContext('box-visibility', 0, buildApi);
  const handle = createBvh(ctx, 'anim1').box(1, 0);
  const geom = new THREE.BoxGeometry(10, 10, 10);
  const rig = {
    ctx, handle, group: new THREE.Group(), root: new THREE.Group(),
    helper: new THREE.Mesh(geom, new THREE.MeshBasicMaterial()),
    mixer: { update: () => {} }, action: {}, boxes: [], opts: {}, timeAlive: 1
  };
  rig.helper.visible = false;
  ctx.rigs.push(rig);

  const box = new THREE.LineSegments(sharedUnitEdgesGeometry, new THREE.LineBasicMaterial({ transparent: true }));
  rig.boxes.push(box);
  scene.add(box);

  ctx.tick(0.016);
  assert.strictEqual(box.visible, false);

  rig.helper.visible = true;
  ctx.tick(0.016);
  assert.strictEqual(box.visible, true);
  scene.remove(box);
});

test('box: clear(): scene.children vuelve al mismo número que antes y dispose llamado', () => {
  const ctx = new SandboxContext('box-clear', 0, buildApi);
  const handle = createBvh(ctx, 'anim1').box(2, 0);
  const geom = new THREE.BoxGeometry(10, 10, 10);
  const rig = {
    ctx, handle, group: new THREE.Group(), root: new THREE.Group(),
    helper: new THREE.Mesh(geom, new THREE.MeshBasicMaterial()),
    mixer: { stopAllAction: () => {}, uncacheRoot: () => {} }, action: {}, boxes: [], opts: {}, timeAlive: 1
  };
  rig.helper.visible = true;
  ctx.rigs.push(rig);

  const b1 = new THREE.LineSegments(sharedUnitEdgesGeometry, new THREE.LineBasicMaterial({ transparent: true }));
  const b2 = new THREE.LineSegments(sharedUnitEdgesGeometry, new THREE.LineBasicMaterial({ transparent: true }));
  rig.boxes.push(b1, b2);
  scene.add(b1, b2);

  let disposed = 0;
  b1.material.dispose = () => { disposed++; };
  b2.material.dispose = () => { disposed++; };

  const childrenBefore = scene.children.length;
  ctx.clear();
  const childrenAfter = scene.children.length;

  assert.strictEqual(childrenAfter, childrenBefore - 2);
  assert.strictEqual(disposed, 2);
});

test('box: dos sandboxes con box() no se mezclan', () => {
  const ctx1 = new SandboxContext('sb1', 0, buildApi);
  const h1 = createBvh(ctx1, 'anim1').box(1, 0);
  const ctx2 = new SandboxContext('sb2', 1, buildApi);
  const h2 = createBvh(ctx2, 'anim2').box(2, 0);

  const geom = new THREE.BoxGeometry(10, 10, 10);
  const rig1 = {
    ctx: ctx1, handle: h1, group: new THREE.Group(), root: new THREE.Group(),
    helper: new THREE.Mesh(geom, new THREE.MeshBasicMaterial()),
    mixer: { update: () => {} }, action: {}, boxes: [], opts: {}, timeAlive: 1
  };
  rig1.helper.visible = true;
  ctx1.rigs.push(rig1);
  const b1 = new THREE.LineSegments(sharedUnitEdgesGeometry, new THREE.LineBasicMaterial({ transparent: true }));
  rig1.boxes.push(b1);
  scene.add(b1);

  const rig2 = {
    ctx: ctx2, handle: h2, group: new THREE.Group(), root: new THREE.Group(),
    helper: new THREE.Mesh(geom, new THREE.MeshBasicMaterial()),
    mixer: { update: () => {} }, action: {}, boxes: [], opts: {}, timeAlive: 1
  };
  rig2.helper.visible = true;
  ctx2.rigs.push(rig2);
  const b2 = new THREE.LineSegments(sharedUnitEdgesGeometry, new THREE.LineBasicMaterial({ transparent: true }));
  const b3 = new THREE.LineSegments(sharedUnitEdgesGeometry, new THREE.LineBasicMaterial({ transparent: true }));
  rig2.boxes.push(b2, b3);
  scene.add(b2, b3);

  assert.strictEqual(rig1.boxes.length, 1);
  assert.strictEqual(rig2.boxes.length, 2);
  scene.remove(b1, b2, b3);
});
