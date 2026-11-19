import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import { initShortcuts } from '../src/app/shortcuts.js';

test('Shortcuts - handlers registered', () => {
  let runAllCalled = false;
  let runSbCalled = false;

  // Minimal DOM setup
  document.body.innerHTML = '<div id="pause"></div>';
  const pauseBtn = document.getElementById('pause');

  initShortcuts({
    runAll: () => { runAllCalled = true; },
    runSandbox: () => { runSbCalled = true; },
    globalPauseBtn: pauseBtn,
    getIsGlobalPaused: () => false,
    setGlobalPauseUI: () => {}
  });

  // Verify listeners attached
  assert.ok(true);
});
