import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import * as state from '../src/core/state.js';
import { createSandbox, labelInUse, nextFreeLabel, MAX_SANDBOXES, openNewWindow, removeSandbox } from '../src/app/sandboxes.js';

test('Sandboxes - MAX_SANDBOXES is 8', () => {
  assert.strictEqual(MAX_SANDBOXES, 8);
});

test('Sandboxes - labels are unique', () => {
  state.sandboxes.clear();
  const sb1 = createSandbox({ id: 'u1', label: 1 });
  assert.ok(sb1);
  assert.strictEqual(labelInUse(1), true);
  assert.strictEqual(labelInUse(2), false);
});

test('Sandboxes - nextFreeLabel skips used labels', () => {
  state.sandboxes.clear();
  createSandbox({ id: 'n1', label: 1 });
  createSandbox({ id: 'n2', label: 2 });
  assert.strictEqual(nextFreeLabel(), 3);
  state.sandboxes.clear();
});

test('Sandboxes - returns null when at max', () => {
  state.sandboxes.clear();
  for (let i = 0; i < MAX_SANDBOXES; i++) {
    createSandbox({ id: `s${i}`, label: i + 1 });
  }
  assert.strictEqual(state.sandboxes.size, MAX_SANDBOXES);
  const extra = createSandbox({ id: 'extra', label: 99 });
  assert.strictEqual(extra, null);
  state.sandboxes.clear();
});

test('Sandboxes - openNewWindow and removeSandbox', () => {
  state.sandboxes.clear();
  state.windows.length = 0;

  const container = document.createElement('div');
  const sb = openNewWindow(container, () => {});

  assert.ok(sb);
  assert.strictEqual(state.sandboxes.size, 1);
  assert.strictEqual(state.windows.length, 1);

  // Remove sandbox should do nothing if size <= 1
  removeSandbox(sb, null, new Set());
  assert.strictEqual(state.sandboxes.size, 1);

  // Add a second sandbox so we can remove one
  const sb2 = openNewWindow(container, () => {});
  assert.strictEqual(state.sandboxes.size, 2);

  removeSandbox(sb, null, new Set());
  assert.strictEqual(state.sandboxes.size, 1);

  state.sandboxes.clear();
  state.windows.length = 0;
});
