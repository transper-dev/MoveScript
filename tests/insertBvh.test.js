import test from 'node:test';
import assert from 'node:assert';
import { appendBvhToChain } from '../src/dsl/insertBvh.js';

test('InsertBvh - empty code adds bvh block', () => {
  const result = appendBvhToChain('', 'walk');
  assert.strictEqual(result, '[bvh("walk")]');
});

test('InsertBvh - code ending with brackets appends with pipe', () => {
  const result = appendBvhToChain('[bvh("idle")]', 'walk');
  assert.strictEqual(result, '[bvh("idle")]\n>[bvh("walk")]');
});

test('InsertBvh - general code appends with newlines', () => {
  const result = appendBvhToChain('some code', 'walk');
  assert.strictEqual(result, 'some code\n\n[bvh("walk")]');
});
