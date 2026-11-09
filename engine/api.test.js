import test from 'node:test';
import assert from 'node:assert';
import { executeInSandbox } from './api.js';

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
