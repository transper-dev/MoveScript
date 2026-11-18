import { MessageTypes, getTargetOrigin } from '../shared/protocol.js';
import * as state from '../core/state.js';

export function initShortcuts({ runAll, runSandbox, globalPauseBtn, iframe, setGlobalPauseUI, getIsGlobalPaused }) {
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) runAll();
      else if (state.activeSandbox) runSandbox(state.activeSandbox);
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (state.activeSandbox) state.activeSandbox.toggleSave();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
      e.preventDefault();
      if (globalPauseBtn) globalPauseBtn.click();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (state.activeSandbox && state.activeSandbox.win) state.activeSandbox.win.toggleMinimized();
    }
  });

  if (globalPauseBtn) {
    globalPauseBtn.addEventListener("click", () => {
      const isPaused = !getIsGlobalPaused();
      setGlobalPauseUI(isPaused);
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: MessageTypes.PAUSE, paused: isPaused }, getTargetOrigin());
      }
    });
  }
}
