import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import { emit, on, EventBus } from '../src/ui/events.js';

test('UI Events - EventBus emit and on', () => {
    let captured = null;
    on('TEST_CUSTOM_EVENT', (detail) => {
        captured = detail;
    });

    emit('TEST_CUSTOM_EVENT', { message: 'hello event bus' });
    assert.deepStrictEqual(captured, { message: 'hello event bus' });
});

test('UI Events - Stress test with 1000 rapid events', () => {
    let count = 0;
    const eventName = 'STRESS_EVENT';
    on(eventName, (detail) => {
        count += detail.increment;
    });

    for (let i = 0; i < 1000; i++) {
        emit(eventName, { increment: 1 });
    }

    assert.strictEqual(count, 1000);
});

test('UI Events - Multiple listeners execution order and concurrency', () => {
    const results = [];
    const eventName = 'ORDER_EVENT';

    for (let i = 0; i < 10; i++) {
        const id = i;
        on(eventName, () => {
            results.push(id);
        });
    }

    emit(eventName, {});
    assert.strictEqual(results.length, 10);
    for (let i = 0; i < 10; i++) {
        assert.strictEqual(results[i], i);
    }
});
