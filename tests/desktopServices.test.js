import test from 'node:test';
import assert from 'node:assert/strict';
import { createOscMessages, normalizeVrData } from '../electron/desktopServices.js';

test('normalizeVrData accepts finite controller coordinates only', () => {
  assert.deepEqual(normalizeVrData({ c1: [1, 80, 3], c2: [4, 150, 6] }), {
    c1: [1, 80, 3],
    c2: [4, 150, 6]
  });
});

test('normalizeVrData drops malformed or unbounded controller data', () => {
  assert.deepEqual(normalizeVrData({ c1: ['1', 80], c2: [0, Infinity, 0], extra: true }), {
    c1: null,
    c2: null
  });
});

test('createOscMessages maps both controller Y values to bounded OSC values', () => {
  assert.deepEqual(createOscMessages({ c1: [0, 60, 0], c2: [0, 150, 0] }), [
    ['/vr/left_y', 0],
    ['/vr/right_y', 5000]
  ]);
});
