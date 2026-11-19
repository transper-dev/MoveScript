import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import { readLayout, restoreInitial } from '../src/app/persistence.js';

test('Persistence - readLayout returns null when empty', () => {
  global.localStorage.clear();
  assert.strictEqual(readLayout(), null);
});

test('Persistence - readLayout returns layout with windows', () => {
  const layout = { windows: [{ tabs: [{ id: 's1', label: 1 }], active: 's1' }] };
  global.localStorage.setItem('movescript_sandboxes', JSON.stringify(layout));
  const result = readLayout();
  assert.ok(Array.isArray(result.windows));
  assert.strictEqual(result.windows[0].tabs[0].id, 's1');
  global.localStorage.clear();
});

test('Persistence - readLayout migrates legacy items format', () => {
  const legacy = { items: [{ id: 's1', label: 1, left: 10, top: 20, width: 400, height: 300 }] };
  global.localStorage.setItem('movescript_sandboxes', JSON.stringify(legacy));
  const result = readLayout();
  assert.ok(Array.isArray(result.windows));
  assert.strictEqual(result.windows[0].tabs[0].id, 's1');
  global.localStorage.clear();
});

test('Persistence - readLayout returns null for corrupted JSON', () => {
  global.localStorage.setItem('movescript_sandboxes', 'not-json');
  assert.strictEqual(readLayout(), null);
  global.localStorage.clear();
});

test('Persistence - restoreInitial restores from stored layout', () => {
  const layout = { windows: [{ tabs: [{ id: 's1', label: 1 }], active: 's1' }] };
  global.localStorage.setItem('movescript_sandboxes', JSON.stringify(layout));
  global.localStorage.setItem('movescript_sandbox_s1', '[bvh("turn")]');

  const createdSandboxes = [];
  const createSandbox = ({ id, label, code }) => {
    const sb = { id, label, code, markSaved: () => {} };
    createdSandboxes.push(sb);
    return sb;
  };
  const createWindow = () => ({
    tabs: [],
    addTab(sb) { this.tabs.push(sb); },
    selectTab: () => {},
    toggleMinimized: () => {}
  });
  const pendingRuns = new Set();

  const count = restoreInitial(createSandbox, createWindow, pendingRuns);
  assert.strictEqual(count, 1);
  assert.strictEqual(createdSandboxes[0].id, 's1');
  assert.strictEqual(pendingRuns.has('s1'), true);
  global.localStorage.clear();
});
