import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import { initShortcuts } from '../src/app/shortcuts.js';
import * as state from '../src/core/state.js';

test('Shortcuts - keydowns run correctly', () => {
  let runAllCalled = false;
  let runSbCalled = false;
  let toggleSaveCalled = false;
  let toggleMinimizedCalled = false;

  const mockActiveSb = {
    toggleSave: () => { toggleSaveCalled = true; },
    win: {
      toggleMinimized: () => { toggleMinimizedCalled = true; }
    }
  };
  state.setActiveSandbox(mockActiveSb);

  document.body.innerHTML = '<div id="pause"></div>';
  const pauseBtn = document.getElementById('pause');
  let pauseBtnClicked = false;
  pauseBtn.addEventListener('click', () => { pauseBtnClicked = true; });

  let isPausedState = false;

  initShortcuts({
    runAll: () => { runAllCalled = true; },
    runSandbox: () => { runSbCalled = true; },
    globalPauseBtn: pauseBtn,
    getIsGlobalPaused: () => isPausedState,
    setGlobalPauseUI: (v) => { isPausedState = v; },
    iframe: {
      contentWindow: {
        postMessage: () => {}
      }
    }
  });

  const KeyboardEvent = global.window.KeyboardEvent;

  // 1. Ctrl+Enter -> shiftKey is true (Run All)
  let event = new KeyboardEvent('keydown', { ctrlKey: true, key: 'Enter', shiftKey: true });
  global.window.dispatchEvent(event);
  assert.strictEqual(runAllCalled, true);

  // 2. Ctrl+Enter -> shiftKey is false (Run Sandbox)
  event = new KeyboardEvent('keydown', { ctrlKey: true, key: 'Enter', shiftKey: false });
  global.window.dispatchEvent(event);
  assert.strictEqual(runSbCalled, true);

  // 3. Ctrl+s -> toggleSave
  event = new KeyboardEvent('keydown', { ctrlKey: true, key: 's' });
  global.window.dispatchEvent(event);
  assert.strictEqual(toggleSaveCalled, true);

  // 4. Ctrl+p -> clicks pause button
  event = new KeyboardEvent('keydown', { ctrlKey: true, key: 'p' });
  global.window.dispatchEvent(event);
  assert.strictEqual(pauseBtnClicked, true);

  // 5. Escape -> toggleMinimized
  event = new KeyboardEvent('keydown', { key: 'Escape' });
  global.window.dispatchEvent(event);
  assert.strictEqual(toggleMinimizedCalled, true);

  state.setActiveSandbox(null);
});
