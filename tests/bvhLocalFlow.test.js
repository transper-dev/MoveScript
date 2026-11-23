import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeBvhFileName } from '../electron/validator.js';

test('local BVH flow uses the same canonical filename for save and read', () => {
  const selectedFile = 'urki.bvh';
  const readName = `${selectedFile.replace(/\.bvh$/i, '')}.bvh`;

  assert.equal(sanitizeBvhFileName(selectedFile), 'urki.bvh');
  assert.equal(sanitizeBvhFileName(readName), 'urki.bvh');
});

test('local BVH flow rejects unsafe filenames before IPC', () => {
  assert.throws(() => sanitizeBvhFileName('../urki.bvh'), /Path traversal/);
  assert.throws(() => sanitizeBvhFileName('urki/other.bvh'), /Path traversal/);
});
