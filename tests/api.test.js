import test from 'node:test';
import assert from 'node:assert';
import { executeInSandbox, buildApi } from '../src/engine/api.js';

test('executeInSandbox - security and null prototype check', () => {
    const ctx = {
        api: {
            clear: () => "cleared",
            safe: () => "safe"
        }
    };

    // Test: Restricts global access like window or globalThis
    assert.throws(() => {
        executeInSandbox(ctx, "window;");
    }, /SecurityError/);

    // Test: Prevents escape via constructor.constructor
    assert.throws(() => {
        executeInSandbox(ctx, "constructor.constructor('return this')()");
    }, /SecurityError/);

    // Test: Allows Math safely
    assert.doesNotThrow(() => {
        executeInSandbox(ctx, "Math.sin(0); clear(); safe();");
    });
});

test('buildApi - builds API methods correctly', () => {
    const ctx = {
        params: {},
        clear: () => {}
    };
    const api = buildApi(ctx);
    assert.strictEqual(typeof api.clear, 'function');
    assert.strictEqual(typeof api.bvh, 'function');
    assert.strictEqual(typeof api.duplicate, 'function');
    assert.strictEqual(typeof api.speed, 'function');
    assert.strictEqual(typeof api.skeleton, 'function');
    assert.strictEqual(typeof api.scale, 'function');
    assert.strictEqual(typeof api.reverse, 'function');
    assert.strictEqual(typeof api.color, 'function');
    assert.strictEqual(typeof api.trail, 'function');
    assert.strictEqual(typeof api.delay, 'function');
    assert.strictEqual(typeof api.pause, 'function');
    assert.strictEqual(typeof api.grid, 'function');
    assert.strictEqual(typeof api.cam, 'function');
    assert.strictEqual(typeof api.background, 'function');
    assert.strictEqual(typeof api.bg, 'function');
    assert.strictEqual(typeof api.rot, 'function');
    assert.strictEqual(typeof api.$B, 'function');
    assert.strictEqual(typeof api.CHAIN, 'function');

    api.speed(2);
    assert.strictEqual(ctx.params.speed, 2);
    api.skeleton(false);
    assert.strictEqual(ctx.params.showSkeleton, false);
    api.scale(1.5);
    assert.strictEqual(ctx.params.globalScale, 1.5);
    api.reverse(true);
    assert.strictEqual(ctx.params.reverse, true);
    api.color('#ff0000', '#00ff00');
    assert.strictEqual(ctx.params.color, '#ff0000');
    assert.strictEqual(ctx.params.color2, '#00ff00');
    api.trail(5);
    assert.strictEqual(ctx.params.trail, 5);
    api.delay(1);
    assert.strictEqual(ctx.params.delay, 1);
});
