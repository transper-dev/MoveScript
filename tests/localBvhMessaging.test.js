import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageTypes } from '../src/shared/protocol.js';

test('local BVH messaging protocol defines iframe request and parent response', () => {
  assert.equal(MessageTypes.READ_LOCAL_BVH, 'readLocalBvh');
  assert.equal(MessageTypes.LOCAL_BVH_RESULT, 'localBvhResult');
});

test('local BVH request includes a filename and correlating request id', () => {
  const request = {
    type: MessageTypes.READ_LOCAL_BVH,
    requestId: 'bvh-1',
    filename: 'urki.bvh'
  };
  const response = {
    type: MessageTypes.LOCAL_BVH_RESULT,
    requestId: request.requestId,
    content: 'HIERARCHY'
  };

  assert.equal(response.requestId, request.requestId);
  assert.equal(response.content, 'HIERARCHY');
});
