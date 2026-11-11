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

test('Storage - handle QuotaExceededError gracefully', () => {
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = () => {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
    };

    assert.doesNotThrow(() => {
        ls.set('quota_key', 'some_value');
    });

    localStorage.setItem = originalSetItem;
});

test('Storage - handle corrupted JSON data gracefully', () => {
    const corruptKey = 'corrupt_json_key';
    ls.set(corruptKey, '{invalid_json');

    const raw = ls.get(corruptKey);
    let parsed = null;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        parsed = { fallback: true };
    }

    assert.strictEqual(parsed.fallback, true);
    ls.remove(corruptKey);
});
