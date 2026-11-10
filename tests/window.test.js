import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import { SandboxWindow } from '../src/ui/sandboxWindow.js';
import { windows } from '../src/core/state.js';

test('SandboxWindow - lifecycle, tabs and layout', () => {
    const win = new SandboxWindow({ left: 100, top: 100, width: '500px', height: '400px' });
    assert.ok(win.el);
    assert.strictEqual(win.tabs.length, 0);

    // Create a mock Sandbox
    const mockSb = {
        id: 's1',
        label: 1,
        hasStored: true,
        tabEl: document.createElement('div'),
        holder: document.createElement('div'),
        cm: { refresh: () => {} },
        syncUI: () => {}
    };

    win.addTab(mockSb);
    assert.strictEqual(win.tabs.length, 1);
    assert.strictEqual(win.activeSb, mockSb);

    // Test getLayout
    const layout = win.getLayout();
    assert.ok(layout);
    assert.strictEqual(layout.tabs.length, 1);
    assert.strictEqual(layout.tabs[0].id, 's1');

    // Test minimization
    win.toggleMinimized();
    assert.strictEqual(win.el.classList.contains('minimized'), true);
    win.toggleMinimized();
    assert.strictEqual(win.el.classList.contains('minimized'), false);

    // Test detachTab
    win.detachTab(mockSb);
    assert.strictEqual(win.tabs.length, 0);

    // Test destroy
    win.destroy();
    assert.strictEqual(windows.includes(win), false);
});
