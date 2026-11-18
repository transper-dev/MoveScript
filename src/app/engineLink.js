import { MessageTypes, getTargetOrigin } from '../shared/protocol.js';
import * as state from '../core/state.js';

export let engineReady = false;
export const pendingRuns = new Set();
let iframe;

export function initEngineLink(iframeEl, runCodeCallback) {
  iframe = iframeEl;
  window.addEventListener("message", (e) => {
    if (e.source !== iframe.contentWindow) return;
    const d = e.data;
    if (!d || !d.type) return;

    if (d.type === MessageTypes.READY) {
      engineReady = true;
      for (const id of [...pendingRuns]) {
        const sb = state.sandboxes.get(id);
        if (sb) runCodeCallback(sb, sb.cm.getValue());
      }
      pendingRuns.clear();
      return;
    }

    const sb = state.sandboxes.get(d.sandboxId);

    if (d.type === MessageTypes.ERROR) {
      const msg = String(d.message || "").split("\n")[0];
      // showError needs to be handled by the orchestrator (main)
      if (window.showError) window.showError(sb ? `[Sandbox ${sb.label}] ${msg}` : msg, 6000);
      else console.error(msg);
      return;
    }

    if (!sb) return;

    // Handle other message types in the orchestrator or here
    // Let's pass them back up or handle directly if possible.
    // For now, assume a handler for UI messages.
    if (window.handleEngineMessage) window.handleEngineMessage(d, sb);
  });
}

export function sendMessage(type, payload) {
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage({ type, ...payload }, getTargetOrigin());
  }
}
