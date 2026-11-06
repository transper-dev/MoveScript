import test from 'node:test';
import assert from 'node:assert';
import { MessageTypes, createMessage, isMessageType } from '../shared/protocol.js';

test('Protocol - Message Types', (_t) => {
  assert.strictEqual(MessageTypes.EXECUTE, 'execute');
  assert.strictEqual(MessageTypes.READY, 'ready');

  const msg = createMessage(MessageTypes.EXECUTE, { sandboxId: 's1', code: 'test' });
  assert.strictEqual(msg.type, 'execute');
  assert.strictEqual(msg.sandboxId, 's1');

  assert.strictEqual(isMessageType(msg, MessageTypes.EXECUTE), true);
  assert.strictEqual(isMessageType(msg, MessageTypes.READY), false);
});
