import test from 'node:test';
import assert from 'node:assert';
import { parseBlocks, transpileBlock } from '../src/dsl/transpile.js';

test('DSL Parser - distinguish DSL from JS arrays', () => {
  const jsArrayCode = 'const f = [1, 2];';
  const blocks1 = parseBlocks(jsArrayCode);
  assert.strictEqual(blocks1.length, 0, 'JS array should not be a DSL block');

  const jsArrayCode2 = 'const f = [1, 2].map(x => x);';
  const blocks2 = parseBlocks(jsArrayCode2);
  assert.strictEqual(blocks2.length, 0, 'JS array method chain should not be a DSL block');

  const commentCode = '// [bvh("a")]';
  const blocks3 = parseBlocks(commentCode);
  assert.strictEqual(blocks3.length, 0, 'Commented block should not be a DSL block');

  const dslCode = '[bvh("a")]';
  const blocks4 = parseBlocks(dslCode);
  assert.strictEqual(blocks4.length, 1, 'DSL block should be parsed');
});

test('DSL Parser - detect syntax error ].', () => {
    const code = '[bvh("a")].color("red")';
    assert.throws(() => {
        parseBlocks(code);
    }, /Error de sintaxis/);
});

test('DSL Parser - detect multiple blocks per sandbox rule with semicolon separation', () => {
    const validCode = '[bvh("froging")]>[color("red")]';
    const validBlocks = parseBlocks(validCode);
    assert.strictEqual(validBlocks.length, 1, 'Single block should have length 1');

    const multiBlockCode = '[bvh("froging")]>[color("red")]; [bvh("headbutt")]';
    const multiBlocks = parseBlocks(multiBlockCode);
    assert.strictEqual(multiBlocks.length, 2, 'Multiple blocks separated by semicolon should be detected (length > 1)');

    const multiBlockLinesCode = '[bvh("froging")]\n>[color("red")]\n[bvh("headbutt")]';
    const multiBlocksLines = parseBlocks(multiBlockLinesCode);
    assert.strictEqual(multiBlocksLines.length, 2, 'Multiple blocks on separate lines should be detected (length > 1)');
});

test('DSL Parser - preserve surrounding code', () => {
    const code = 'bg("#001"); cam(0,100,300);\n[bvh("a")]';
    const blocks = parseBlocks(code);
    assert.strictEqual(blocks.length, 1);
    const transpiledCode = code.slice(0, blocks[0].start) + transpileBlock(blocks[0]) + code.slice(blocks[0].end);
    assert.strictEqual(transpiledCode, 'bg("#001"); cam(0,100,300);\nCHAIN($B().bvh("a"))');
});
