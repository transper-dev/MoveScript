import { Sandbox } from '../ui/sandbox.js';
import { SandboxWindow } from '../ui/sandboxWindow.js';
import { ls, codeKey } from '../ui/storage.js';
import { MessageTypes, getTargetOrigin } from '../shared/protocol.js';
import * as state from '../core/state.js';
import { writeLayout } from '../core/layout.js';

export const MAX_SANDBOXES = 8;

export function refreshOnlyOne() {
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.toggle("only-one", state.sandboxes.size <= 1);
  }
}

export function labelInUse(n) {
  return [...state.sandboxes.values()].some(sb => sb.label === n);
}

export function nextFreeLabel() {
  let n = 1;
  while (labelInUse(n)) n++;
  return n;
}

export function createSandbox({ id, label, code = "", hasStored = false } = {}, showError) {
  if (state.sandboxes.size >= MAX_SANDBOXES) {
    if (showError) showError(`Máximo ${MAX_SANDBOXES} sandboxes a la vez.`);
    return null;
  }
  let lbl = Number(label);
  if (!Number.isInteger(lbl) || lbl < 1 || labelInUse(lbl)) lbl = nextFreeLabel();
  let sbId = id || `s${lbl}`;
  while (state.sandboxes.has(sbId)) sbId += "_";

  const sb = new Sandbox(sbId, lbl, { code, hasStored });
  state.sandboxes.set(sbId, sb);
  refreshOnlyOne();
  return sb;
}

export function createWindow(opts, container) {
  const w = new SandboxWindow(opts);
  state.windows.push(w);
  if (container) container.appendChild(w.el);
  return w;
}

export function openNewWindow(container, showError) {
  const sb = createSandbox({}, showError);
  if (!sb) return null;
  const offset = (state.windows.length % 8) * 36;
  const left = Math.min(16 + offset, Math.max(8, window.innerWidth - 475 - 8));
  const top = Math.min(16 + offset, Math.max(8, window.innerHeight - 220 - 8));
  const win = createWindow({ left, top }, container);
  win.addTab(sb);
  sb.activate();
  writeLayout();
  return sb;
}

export function removeSandbox(sb, iframe, pendingRuns) {
  if (state.sandboxes.size <= 1) return;
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage({ type: MessageTypes.REMOVE_SANDBOX, sandboxId: sb.id }, getTargetOrigin());
  }
  if (pendingRuns) pendingRuns.delete(sb.id);
  state.sandboxes.delete(sb.id);
  ls.remove(codeKey(sb.id));

  const win = sb.win;
  const wasActive = state.activeSandbox === sb;
  if (win) {
    win.detachTab(sb);
    if (win.tabs.length === 0) win.destroy();
  }
  sb.destroy();

  if (wasActive) {
    state.setActiveSandbox(null);
    const w = (win && state.windows.includes(win)) ? win : state.windows[state.windows.length - 1];
    if (w && w.activeSb) w.activeSb.activate();
  }
  refreshOnlyOne();
  writeLayout();
}
