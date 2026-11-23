import test from 'node:test';
import assert from 'node:assert';
import { parseBlocks, transpileBlock } from '../src/dsl/transpile.js';

test('DSL Parser - handle commented chain line', () => {
    const code = '[bvh("froging")]\n//>[bvh("headbutt")]';
    const blocks = parseBlocks(code);
    assert.strictEqual(blocks.length, 1);
    const transpiled = transpileBlock(blocks[0]);
    assert.strictEqual(transpiled, 'CHAIN($B().bvh("froging"))');
});
