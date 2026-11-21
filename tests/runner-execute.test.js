import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import { initRunner, runCode } from '../src/app/runner.js';
import { MessageTypes } from '../src/shared/protocol.js';

test('Runner - correctly posts EXECUTE message', () => {
  let messageSent = null;
  const mockIframe = {
    contentWindow: {
      postMessage: (msg, origin) => { messageSent = msg; }
    }
  };
  initRunner(mockIframe);

  const sb = { id: 's1', label: '1', clearChainMarks: () => {}, syncUI: () => {}, paused: false };
  const mockShowError = () => {};
  const mockSetGlobalPauseUI = () => {};

  runCode(sb, '[bvh("turn")]', mockShowError, mockSetGlobalPauseUI);

  assert.ok(messageSent, 'Message should have been sent');
  assert.strictEqual(messageSent.type, MessageTypes.EXECUTE);
  assert.strictEqual(messageSent.sandboxId, 's1');
  assert.strictEqual(typeof messageSent.order, 'number');
});
