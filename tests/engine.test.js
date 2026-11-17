import './setup.js'; // MUST import first!
import test from 'node:test';
import assert from 'node:assert';
import { getCtx, SandboxContext } from '../src/engine/context.js';
import { SANDBOX_SPACING } from '../src/engine/utils.js';
import { scene } from '../src/engine/scene.js';
import { RigNode, makeChain, duplicateHandle, createBvh } from '../src/engine/bvh.js';

test('SandboxContext life cycle & getCtx', () => {
    const ctx1 = getCtx('s1', () => ({}));
    const ctx2 = getCtx('s2', () => ({}));

    assert.strictEqual(ctx1.order, 0, 'First sandbox should be order 0');
    assert.strictEqual(ctx2.order, 1, 'Second sandbox should be order 1');

    assert.strictEqual(ctx1.defaultX, 0 * SANDBOX_SPACING, 'Order 0 default X should be 0');
    assert.strictEqual(ctx2.defaultX, 1 * SANDBOX_SPACING, 'Order 1 default X should be SANDBOX_SPACING');

    // Test timer methods (later, every, cancel)
    let fired = false;
    const tid = ctx1.later(() => { fired = true; }, 10);
    assert.ok(tid);
    ctx1.cancel(tid);

    let count = 0;
    const intervalId = ctx1.every((id) => { count++; }, 10);
    assert.ok(intervalId);
    ctx1.cancel(intervalId);

    // Test tick execution
    ctx1.tick(0.016);

    // clear() verification
    const initialChildrenCount = scene.children.length;
    ctx1.clear();
    assert.strictEqual(ctx1.rigs.length, 0, 'Rigs should be cleared');
    assert.strictEqual(ctx1.timers.size, 0, 'Timers should be cleared');

    ctx1.destroy();
});

test('RigNode, makeChain and duplicateHandle with Three.js', () => {
    const ctx = getCtx('test-engine', () => ({}));

    // Test RigNode builder
    const node = new RigNode().bvh('walk').pos(10, 20, 30).scale(2).speed(1.5);
    assert.strictEqual(node.props.file, 'walk');
    assert.strictEqual(node.props.x, 10);
    assert.strictEqual(node.props.scale, 2);

    // Test makeChain
    const chainFn = makeChain(ctx);
    const handle = chainFn(new RigNode().bvh('walk'));
    assert.ok(handle, 'makeChain should return a handle');

    // Test duplicateHandle
    const dupHandle = duplicateHandle(ctx, handle);
    assert.ok(dupHandle, 'duplicateHandle should return a duplicated handle');

    ctx.clear();
});
