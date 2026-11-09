import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import { ls, LIST_KEY, codeKey } from '../src/ui/storage.js';

test('Storage - basic operations', () => {
    const key = 'test_key';
    const value = 'test_value';

    ls.set(key, value);
    assert.strictEqual(ls.get(key), value);

    ls.remove(key);
    assert.strictEqual(ls.get(key), null);
});

test('Storage - codeKey helper', () => {
    assert.strictEqual(codeKey('1'), 'movescript_sandbox_1');
});

test('Storage - handle JSON parse/serialization logic simulation', () => {
    const layout = { windows: [{ tabs: [{ id: '1', label: '1' }] }] };
    const json = JSON.stringify(layout);
    ls.set(LIST_KEY, json);

    const retrieved = JSON.parse(ls.get(LIST_KEY));
    assert.deepStrictEqual(retrieved, layout);
    ls.remove(LIST_KEY);
});
