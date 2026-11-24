import test from 'node:test';
import assert from 'node:assert/strict';
import { getXrBoneBounds, getXrTransform, parseXrCode } from '../src/xr/protocol.js';

test('parseXrCode extracts the first animation and visual controls', () => {
  assert.deepEqual(parseXrCode('[bvh("walk").color("red", "blue").scale(2).speed(0.5).reverse()]'), {
    file: 'walk',
    color: 'red',
    color2: 'blue',
    scale: 2,
    speed: 0.5,
    reverse: true,
    position: [0, 0, 0],
    rotationY: 0,
    dummy: false
  });
});

test('parseXrCode uses a safe dummy fallback for unsupported payloads', () => {
  assert.deepEqual(parseXrCode({ code: 'background("red")' }), {
    file: 'dummy',
    color: null,
    color2: null,
    scale: 1,
    speed: 1,
    reverse: false,
    position: [0, 0, 0],
    rotationY: 0,
    dummy: false
  });
});

test('parseXrCode supports position, rotation, dummy, and chained blocks', () => {
  assert.deepEqual(parseXrCode('[bvh("walk").pos(2, 3, -4).rotY(1.5).dummy()]>[bvh("next")]'), {
    file: 'walk',
    color: null,
    color2: null,
    scale: 1,
    speed: 1,
    reverse: false,
    position: [2, 3, -4],
    rotationY: 1.5,
    dummy: true
  });
});

test('parseXrCode clamps non-finite and extreme numeric modifiers', () => {
  const state = parseXrCode('[bvh("walk").pos(999999999999999999999999, -999999999999999999999999, 2).scale(999999999999999999999999).speed(-999999999999999999999999).rotY(999999999999999999999999)]');

  assert.deepEqual(state.position, [100, -100, 2]);
  assert.equal(state.scale, 10);
  assert.equal(state.speed, -10);
  assert.equal(state.rotationY, Math.PI * 2);
  assert.ok(state.position.every(Number.isFinite));
});

test('parseXrCode falls back when modifiers contain non-finite values', () => {
  const state = parseXrCode('[bvh("walk").pos(NaN, Infinity, -Infinity).scale(NaN).speed(Infinity).rotY(NaN)]');

  assert.deepEqual(state.position, [0, 0, 0]);
  assert.equal(state.scale, 1);
  assert.equal(state.speed, 1);
  assert.equal(state.rotationY, 0);
});

test('getXrTransform uses finite defaults for empty BVH bounds', () => {
  assert.deepEqual(getXrTransform({ minY: Infinity, height: 0, centerX: 0 }, { position: [0, 0, 0], scale: 1 }), {
    scale: 1,
    position: [0, 0, -4]
  });
});

test('getXrBoneBounds measures bone world positions for BVH rigs', () => {
  const bones = [
    { isBone: true, getWorldPosition: target => target.set(0, 1, 0) },
    { isBone: true, getWorldPosition: target => target.set(2, 3, 0) }
  ];

  assert.deepEqual(getXrBoneBounds(bones), {
    minY: 1,
    height: 2,
    centerX: 1
  });
});
