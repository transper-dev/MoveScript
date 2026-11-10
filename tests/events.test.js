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
