import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import { writeLayout, scheduleLayoutSave } from '../src/core/layout.js';
import { ls, LIST_KEY } from '../src/ui/storage.js';
import * as state from '../src/core/state.js';

test('Core Layout - writeLayout and scheduleLayoutSave', () => {
    ls.remove(LIST_KEY);
    state.windows.length = 0;

    // When no windows, writeLayout removes LIST_KEY
    writeLayout();
    assert.strictEqual(ls.get(LIST_KEY), null);

    // Mock window with getLayout
    const mockWindow = {
        getLayout: () => ({ left: 10, top: 20, width: '400px', height: '300px', minimized: false, tabs: [{ id: '1', label: '1' }], active: '1' })
    };
    state.windows.push(mockWindow);

    writeLayout();
    const saved = JSON.parse(ls.get(LIST_KEY));
    assert.ok(saved);
    assert.strictEqual(saved.windows.length, 1);
    assert.strictEqual(saved.windows[0].left, 10);

    // Test scheduleLayoutSave (async timeout)
    state.windows.length = 0;
    scheduleLayoutSave();

    // Cleanup
    ls.remove(LIST_KEY);
});
