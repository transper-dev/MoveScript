import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import { initRunner, runCode } from '../src/app/runner.js';

// Provide a mock iframe and sortedByLabel before tests
const mockIframe = { contentWindow: { postMessage: () => {} } };
initRunner(mockIframe, () => []);

test('Runner - single block transpiles without error', () => {
  const sb = { id: 's1', label: '1', clearChainMarks: () => {}, syncUI: () => {}, paused: false };
  let error;
  runCode(sb, '[bvh("turn")]', (e) => { error = e; }, () => {});
  assert.strictEqual(error, undefined);
});

test('Runner - rejects multiple blocks', () => {
  const sb = { id: 's1', label: '1', clearChainMarks: () => {}, syncUI: () => {}, paused: false };
  let error;
  runCode(sb, '[bvh("turn")]\n\n[bvh("walk")]', (e) => { error = e; }, () => {});
  assert.ok(error && error.includes('Solo se permite una secuencia continua'));
});

test('Runner - rejects point after ]', () => {
  const sb = { id: 's1', label: '1', clearChainMarks: () => {}, syncUI: () => {}, paused: false };
  let error;
  runCode(sb, '[bvh("turn")].\n[bvh("walk")]', (e) => { error = e; }, () => {});
  assert.ok(error !== undefined);
});
