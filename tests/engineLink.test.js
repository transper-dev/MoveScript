import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import { initEngineLink, pendingRuns, sendMessage } from '../src/app/engineLink.js';
import * as state from '../src/core/state.js';
import { MessageTypes } from '../src/shared/protocol.js';

test('EngineLink - READY message executes pending runs', () => {
  pendingRuns.clear();
  state.sandboxes.clear();

  const sb = { id: 's1', label: 1, cm: { getValue: () => 'code' } };
  state.sandboxes.set('s1', sb);
  pendingRuns.add('s1');

  let runCodeCalled = false;
  const runCodeCallback = (s, code) => {
    runCodeCalled = true;
    assert.strictEqual(s.id, 's1');
    assert.strictEqual(code, 'code');
  };

  const iframe = { contentWindow: {} };
  initEngineLink(iframe, runCodeCallback);

  // Directly simulate READY message event on window
  const event = new global.window.MessageEvent('message', {
    source: iframe.contentWindow,
    data: { type: MessageTypes.READY }
  });
  global.window.dispatchEvent(event);

  assert.strictEqual(runCodeCalled, true);
});

test('EngineLink - ERROR message calls showError', () => {
  let errorShown = null;
  global.window.showError = (msg) => { errorShown = msg; };

  state.sandboxes.clear();
  const sb = { id: 's1', label: 1 };
  state.sandboxes.set('s1', sb);

  const iframe = { contentWindow: {} };
  initEngineLink(iframe, () => {});

  // Directly simulate ERROR message event on window
  const event = new global.window.MessageEvent('message', {
    source: iframe.contentWindow,
    data: { type: MessageTypes.ERROR, message: 'something bad', sandboxId: 's1' }
  });
  global.window.dispatchEvent(event);

  assert.strictEqual(errorShown, '[Sandbox 1] something bad');
  delete global.window.showError;
});
