import test from 'node:test';
import assert from 'node:assert';
import * as state from '../src/core/state.js';
import { registerActions, getAction } from '../src/core/actions.js';

test('Core State - management and zCounter', () => {
    assert.ok(state.sandboxes instanceof Map);
    assert.ok(Array.isArray(state.windows));
    assert.strictEqual(state.activeSandbox, null);

    const initialZ = state.incrementZCounter();
    assert.strictEqual(state.incrementZCounter(), initialZ + 1);

    const dummySb = { id: 'test-sb' };
    state.setActiveSandbox(dummySb);
    assert.strictEqual(state.activeSandbox, dummySb);

    // Reset state for other tests
    state.setActiveSandbox(null);
});

test('Core Actions - registry and retrieval', () => {
    const mockAction = () => 'success';
    registerActions({ testAction: mockAction });

    const retrieved = getAction('testAction');
    assert.strictEqual(retrieved(), 'success');
    assert.strictEqual(getAction('nonExistentAction'), undefined);
});
