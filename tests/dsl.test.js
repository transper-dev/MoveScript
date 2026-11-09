import test from 'node:test';
import assert from 'node:assert';
import { parseBlocks, isNewBlock, transpileBlock } from '../src/dsl/transpile.js';

test('DSL Transpiler - parseBlocks', (_t) => {
  // 1. Basic parsing
  const code = '[bvh("walk")]>[pos(1,2,3)]';
  const blocks = parseBlocks(code);
  assert.strictEqual(blocks.length, 1);
  assert.deepStrictEqual(blocks[0].parts, ['[bvh("walk")]', '[pos(1,2,3)]']);

  // 2. Comments ignored
  const codeWithComments = '// a comment\n[bvh("walk")]>[pos(1,2,3)]';
  const blocksWithComments = parseBlocks(codeWithComments);
  assert.strictEqual(blocksWithComments.length, 1);
  assert.deepStrictEqual(blocksWithComments[0].parts, ['[bvh("walk")]', '[pos(1,2,3)]']);

  // 3. String literal safety
  const codeWithStrings = '[bvh("walk>run")]';
  const blocksWithStrings = parseBlocks(codeWithStrings);
  assert.strictEqual(blocksWithStrings.length, 1);
  assert.deepStrictEqual(blocksWithStrings[0].parts, ['[bvh("walk>run")]']);
});

test('DSL Transpiler - isNewBlock', (_t) => {
  const lines = [
    '[bvh("walk")]',
    '  > [pos(1,2,3)]',
    '[bvh("run")]'
  ];
  assert.strictEqual(isNewBlock(lines, 0), true);
  assert.strictEqual(isNewBlock(lines, 1), false);
  assert.strictEqual(isNewBlock(lines, 2), true);
});

test('DSL Transpiler - transpileBlock', (_t) => {
  const block = {
    parts: ['[bvh("walk")]', '[pos(1,2,3)]']
  };
  const code = transpileBlock(block);
  assert.strictEqual(code, 'CHAIN($B().bvh("walk"), $B().pos(1,2,3))');

  const singleBlock = {
    parts: ['[bvh("headbutt")]']
  };
  const singleCode = transpileBlock(singleBlock);
  assert.strictEqual(singleCode, 'CHAIN($B().bvh("headbutt"))');
});
