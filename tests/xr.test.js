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
    reverse: true
  });
});

test('parseXrCode uses a safe dummy fallback for unsupported payloads', () => {
  assert.deepEqual(parseXrCode({ code: 'background("red")' }), {
    file: 'dummy',
    color: null,
    color2: null,
    scale: 1,
    speed: 1,
    reverse: false
  });
});
