import CodeMirror from 'codemirror';
import 'codemirror/mode/javascript/javascript.js';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import './styles/index.css';
window.CodeMirror = CodeMirror;

import { setEditorFactory } from './ui/editorFactory.js';
setEditorFactory(CodeMirror);

import { MessageTypes } from './shared/protocol.js';
import { ls } from './ui/storage.js';
import { on } from './ui/events.js';
import * as state from './core/state.js';
import { registerActions } from './core/actions.js';
import { writeLayout, scheduleLayoutSave } from './core/layout.js';

import { restoreInitial } from './app/persistence.js';
import { initEngineLink, engineReady, pendingRuns } from './app/engineLink.js';
import { runSandbox as runSandboxLogic, runCode as runCodeLogic, initRunner } from './app/runner.js';
import { initShortcuts } from './app/shortcuts.js';
import { createSandbox as createSandboxFn, createWindow as createWindowFn, removeSandbox as removeSandboxFn, openNewWindow } from './app/sandboxes.js';

export { writeLayout, scheduleLayoutSave };

const iframe = document.getElementById("preview");
const container = document.getElementById("sandboxes");
const addSandboxBtn = document.getElementById("addSandboxBtn");
const runAllBtn = document.getElementById("runAllBtn");
const globalPauseBtn = document.getElementById("globalPauseBtn");
const errorToast = document.getElementById("error-toast");
const errorText = document.getElementById("error-text");

let isGlobalPaused = false;
let errorTimeout;

export function setActiveSandbox(sb) { state.setActiveSandbox(sb); }
export function incrementZCounter() { return state.incrementZCounter(); }

Object.defineProperty(window, "editor", {
  get: () => (state.activeSandbox ? state.activeSandbox.cm : null),
  configurable: true
});
window.runActiveSandbox = () => { if (state.activeSandbox) runSandbox(state.activeSandbox); };

function setGlobalPauseUI(paused) {
  isGlobalPaused = paused;
  if (!globalPauseBtn) return;
  const icon = globalPauseBtn.querySelector("i");
  const label = globalPauseBtn.querySelector(".btn-label");
  if (icon) icon.className = paused ? "fas fa-play" : "fas fa-pause";
  if (label) label.textContent = paused ? "Play All" : "Pause All";
  globalPauseBtn.classList.toggle("paused", paused);
  globalPauseBtn.title = paused ? "Reanudar todo (Ctrl+P)" : "Pausar todo (Ctrl+P)";
}

window.showError = function showError(message, ms = 4000) {
  if (!errorToast || !errorText) { console.error(message); return; }
  errorText.textContent = message;
  errorToast.classList.add("visible");
  clearTimeout(errorTimeout);
  errorTimeout = setTimeout(() => errorToast.classList.remove("visible"), ms);
};

const sortedByLabel = () => [...state.sandboxes.values()].sort((a, b) => a.label - b.label);

export function createSandbox(opts) {
  return createSandboxFn(opts, window.showError);
}

export function createWindow(opts) {
  return createWindowFn(opts, container);
}

export function removeSandbox(sb) {
  removeSandboxFn(sb, iframe, pendingRuns);
}

if (addSandboxBtn) {
  addSandboxBtn.addEventListener("click", () => {
    const sb = openNewWindow(container, window.showError);
    if (sb) sb.cm.focus();
  });
}

export function runSandbox(sb) {
  if (errorToast) errorToast.classList.remove("visible");
  if (!engineReady) pendingRuns.add(sb.id);
  runSandboxLogic(sb, (s, c) => runCode(s, c));
}

function runCode(sb, code) {
  runCodeLogic(sb, code, window.showError, setGlobalPauseUI);
}

export function runAll() {
  if (errorToast) errorToast.classList.remove("visible");
  for (const sb of sortedByLabel()) {
    if (!engineReady) pendingRuns.add(sb.id);
    else runCode(sb, sb.cm.getValue());
  }
}
if (runAllBtn) runAllBtn.addEventListener("click", runAll);

window.handleEngineMessage = function(d, sb) {
  if (d.type === MessageTypes.RIG_MOVED) {
    sb.updateEditor(d.codeIndex, (st, bIdx) => {
      let inside = st.substring(0, bIdx);
      inside = removeMethodCall(inside, "pos");
      inside = removeMethodCall(inside, "x");
      inside = removeMethodCall(inside, "z");
      return inside + `.pos(${Math.round(d.x)}, 0, ${Math.round(d.z)})` + st.substring(bIdx);
    });
  } else if (d.type === MessageTypes.RIG_ROTATED) {
    sb.updateEditor(d.codeIndex, (st, bIdx) => {
      let inside = st.substring(0, bIdx);
      inside = removeMethodCall(inside, "rotX");
      inside = removeMethodCall(inside, "rotY");
      let rStr = "";
      if (Math.abs(d.rotX) > 0.01) rStr += `.rotX(${d.rotX.toFixed(2)})`;
      if (Math.abs(d.rotY) > 0.01) rStr += `.rotY(${d.rotY.toFixed(2)})`;
      return inside + rStr + st.substring(bIdx);
    });
  } else if (d.type === MessageTypes.RIG_SELECTED) {
    state.sandboxes.forEach(other => { if (other !== sb) other.isRigSelected = false; });
    sb.isRigSelected = true;
    sb.activate();
    sb.updateEditor(d.codeIndex, null);
  } else if (d.type === MessageTypes.RIG_DESELECTED) {
    sb.isRigSelected = false;
    const cursor = sb.cm.getCursor();
    sb.cm.setSelection(cursor, cursor);
  } else if (d.type === MessageTypes.CHAIN_STEP) {
    sb.currentChainSteps[d.codeIndex] = d.step;
    sb.highlightStep(d.codeIndex, d.step);
  }
};

export function removeMethodCall(str, methodName) {
  let result = "";
  let i = 0;
  const prefix = "." + methodName + "(";
  while (i < str.length) {
    const idx = str.indexOf(prefix, i);
    if (idx === -1) { result += str.slice(i); break; }
    result += str.slice(i, idx);
    let depth = 0;
    let j = idx + prefix.length - 1;
    while (j < str.length) {
      const ch = str[j];
      if (ch === '"' || ch === "'" || ch === '`') {
        const sc = ch;
        j++;
        while (j < str.length) {
          if (str[j] === sc && str[j - 1] !== '\\') { j++; break; }
          j++;
        }
        continue;
      }
      if (ch === "(") depth++;
      else if (ch === ")") { depth--; if (depth === 0) { j++; break; } }
      j++;
    }
    i = j;
  }
  return result;
}

initShortcuts({
  runAll,
  runSandbox: (sb) => runSandbox(sb),
  globalPauseBtn,
  iframe,
  setGlobalPauseUI,
  getIsGlobalPaused: () => isGlobalPaused
});

on("REMOVE_SANDBOX", removeSandbox);

function init() {
  iframe.src = './preview.html';
  initRunner(iframe);
  initEngineLink(iframe, runCode);

  const restored = restoreInitial(createSandbox, createWindow, pendingRuns);
  if (restored === 0) {
    const first = createSandbox({ id: "default", label: 1, code: ls.get("movescript_saved_code") || "", hasStored: ls.get("movescript_saved_code") !== null });
    const win = createWindow({ left: 16, top: 16 });
    win.addTab(first);
    if (ls.get("movescript_saved_code") !== null) {
      first.markSaved();
      writeLayout();
      ls.remove("movescript_saved_code");
    }
    first.activate();
    pendingRuns.add(first.id);
  } else if (state.windows.length > 0 && state.windows[0].activeSb) {
    state.windows[0].activeSb.activate();
  }
}

registerActions({
  createSandbox,
  createWindow,
  runSandbox,
  runAll,
  writeLayout,
  scheduleLayoutSave
});

on("RUN_SANDBOX", (sb) => runSandbox(sb));
on("RUN_ALL", () => runAll());

window.addEventListener("beforeunload", writeLayout);

init();
