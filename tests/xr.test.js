import test from 'node:test';
import assert from 'node:assert/strict';
import { parseXrCode } from '../src/xr/protocol.js';

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
