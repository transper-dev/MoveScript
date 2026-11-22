import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import * as THREE from 'three';
import { setFloor, scene } from '../src/engine/scene.js';

test('floor: default args and position.y = -1', () => {
  setFloor();
  const mesh = scene.children.find(c => c.isMesh && c.geometry instanceof THREE.PlaneGeometry);
  assert.ok(mesh, 'floor mesh should exist');
  assert.strictEqual(mesh.position.y, -1, 'floor position.y should be -1');
  assert.strictEqual(mesh.geometry.parameters.width, 1000);
});

test('floor: no accumulation on multiple calls (replaces and disposes)', () => {
  let disposeGeom = 0;
  let disposeMat = 0;

  setFloor('#111111', 200);
  const countWithOneFloor = scene.children.length;
  const firstMesh = scene.children.find(c => c.isMesh && c.geometry instanceof THREE.PlaneGeometry);
  const origGeomDispose = firstMesh.geometry.dispose;
  const origMatDispose = firstMesh.material.dispose;
  firstMesh.geometry.dispose = () => { disposeGeom++; origGeomDispose.call(firstMesh.geometry); };
  firstMesh.material.dispose = () => { disposeMat++; origMatDispose.call(firstMesh.material); };

  setFloor('#222222', 300);
  setFloor('#333333', 400);
  setFloor('#444444', 500);
  setFloor('#555555', 600);

  assert.strictEqual(scene.children.length, countWithOneFloor, 'scene.children.length must not grow with repeated setFloor');
  const finalMesh = scene.children.find(c => c.isMesh && c.geometry instanceof THREE.PlaneGeometry);
  assert.strictEqual(finalMesh.geometry.parameters.width, 600);
  assert.ok(disposeGeom > 0, 'geometry should be disposed');
  assert.ok(disposeMat > 0, 'material should be disposed');
});

test('floor: size clamping and NaN handling', () => {
  setFloor('#ff0000', -50);
  let mesh = scene.children.find(c => c.isMesh && c.geometry instanceof THREE.PlaneGeometry);
  assert.strictEqual(mesh.geometry.parameters.width, 1000);

  setFloor('#ff0000', NaN);
  mesh = scene.children.find(c => c.isMesh && c.geometry instanceof THREE.PlaneGeometry);
  assert.strictEqual(mesh.geometry.parameters.width, 1000);

  setFloor('#ff0000', 99999);
  mesh = scene.children.find(c => c.isMesh && c.geometry instanceof THREE.PlaneGeometry);
  assert.strictEqual(mesh.geometry.parameters.width, 10000);
});

test('floor: invalid color uses default and warns', () => {
  let warningMessage = null;
  const origWarn = console.warn;
  console.warn = (...args) => {
    warningMessage = args.join(' ');
  };

  setFloor('not-a-color', 400);
  console.warn = origWarn;

  assert.ok(warningMessage && warningMessage.startsWith('floor():'), 'warning should start with floor():');
  const mesh = scene.children.find(c => c.isMesh && c.geometry instanceof THREE.PlaneGeometry);
  assert.strictEqual(mesh.material.color.getHexString(), '1a1a24');
});

test('floor: valid color formats including red and 0xff0000', () => {
  setFloor('red', 400);
  let mesh = scene.children.find(c => c.isMesh && c.geometry instanceof THREE.PlaneGeometry);
  assert.strictEqual(mesh.material.color.getHexString(), 'ff0000');

  setFloor(0xff0000, 400);
  mesh = scene.children.find(c => c.isMesh && c.geometry instanceof THREE.PlaneGeometry);
  assert.strictEqual(mesh.material.color.getHexString(), 'ff0000');
});

test('floor: floor(false) removes floor', () => {
  setFloor('#123456', 500);
  assert.ok(scene.children.some(c => c.isMesh && c.geometry instanceof THREE.PlaneGeometry));
  setFloor(false);
  assert.ok(!scene.children.some(c => c.isMesh && c.geometry instanceof THREE.PlaneGeometry));
});
