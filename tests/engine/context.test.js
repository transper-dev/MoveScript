import './setup.js'; // MUST import first!
import test from 'node:test';
import assert from 'node:assert';
import { getCtx, SandboxContext } from '../../engine/context.js';
import { SANDBOX_SPACING } from '../../engine/utils.js';

test('SandboxContext life cycle', () => {
    // 1. Que getCtx(id) crea contextos aislados y calcula la posición X correctamente
    const ctx1 = getCtx('s1', () => ({}));
    const ctx2 = getCtx('s2', () => ({}));

    assert.strictEqual(ctx1.order, 0, 'First sandbox should be order 0');
    assert.strictEqual(ctx2.order, 1, 'Second sandbox should be order 1');

    assert.strictEqual(ctx1.defaultX, 0 * SANDBOX_SPACING, 'Order 0 default X should be 0');
    assert.strictEqual(ctx2.defaultX, 1 * SANDBOX_SPACING, 'Order 1 default X should be SANDBOX_SPACING');

    // 2. Que ctx.clear() funciona
    ctx1.clear();
    assert.strictEqual(ctx1.rigs.length, 0, 'Rigs should be cleared');
    assert.strictEqual(ctx1.timers.size, 0, 'Timers should be cleared');
});
