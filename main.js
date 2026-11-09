import { parseBlocks, transpileBlock } from './dsl/transpile.js';
import { MessageTypes, getTargetOrigin } from './shared/protocol.js';
import { Sandbox } from './ui/sandbox.js';
import { SandboxWindow } from './ui/sandboxWindow.js';
import { ls, LIST_KEY, LEGACY_KEY, codeKey } from './ui/storage.js';
import { on } from './ui/events.js';
import * as state from './core/state.js';
import { registerActions } from './core/actions.js';
import { writeLayout, scheduleLayoutSave } from './core/layout.js';
export { writeLayout, scheduleLayoutSave };

function buildPreviewHtml() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body { margin:0; height:100%; overflow:hidden; background:#111; }
    canvas { width:100%; height:100%; display:block; outline: none; }
  </style>
  <script type="importmap">
    {
      "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js",
        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/"
      }
    }
  </script>
</head>
<body>
  <canvas id="c" tabindex="1"></canvas>
  <script type="module" src="./bvhApi.js"></script>
</body>
</html>`;
}

// ====================================================
// ELEMENTOS Y ESTADO GLOBAL
// ====================================================
const iframe = document.getElementById("preview");
const container = document.getElementById("sandboxes");
const addSandboxBtn = document.getElementById("addSandboxBtn");
const runAllBtn = document.getElementById("runAllBtn");
const globalPauseBtn = document.getElementById("globalPauseBtn");
const errorToast = document.getElementById("error-toast");
const errorText = document.getElementById("error-text");

const MAX_SANDBOXES = 8;

const pendingRuns = new Set();    // sandboxIds a ejecutar cuando el motor esté listo
let engineReady = false;
let isGlobalPaused = false;
let errorTimeout;

export function setActiveSandbox(sb) { state.setActiveSandbox(sb); }
export function incrementZCounter() { return state.incrementZCounter(); }

// Compatibilidad
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

function showError(message, ms = 4000) {
  if (!errorToast || !errorText) { console.error(message); return; }
  errorText.textContent = message;
  errorToast.classList.add("visible");
  clearTimeout(errorTimeout);
  errorTimeout = setTimeout(() => errorToast.classList.remove("visible"), ms);
}

const sortedByLabel = () => [...state.sandboxes.values()].sort((a, b) => a.label - b.label);

// ====================================================
// PERSISTENCIA
// ====================================================
function readLayout() {
  let o = null;
  try { o = JSON.parse(ls.get(LIST_KEY)); } catch (e) { return null; }
  if (!o) return null;
  if (Array.isArray(o.windows)) return o;
  if (Array.isArray(o.items)) {
    return {
      windows: o.items.map(it => ({
        left: it.left, top: it.top, width: it.width, height: it.height, minimized: it.minimized,
        tabs: [{ id: it.id, label: it.label }], active: it.id
      }))
    };
  }
  return null;
}
window.addEventListener("beforeunload", writeLayout);

// ====================================================
// CREAR / ELIMINAR (exports)
// ====================================================
function refreshOnlyOne() {
  document.body.classList.toggle("only-one", state.sandboxes.size <= 1);
}

const labelInUse = (n) => [...state.sandboxes.values()].some(sb => sb.label === n);
function nextFreeLabel() {
  let n = 1;
  while (labelInUse(n)) n++;
  return n;
}

export function createSandbox({ id, label, code = "", hasStored = false } = {}) {
  if (state.sandboxes.size >= MAX_SANDBOXES) {
    showError(`Máximo ${MAX_SANDBOXES} sandboxes a la vez.`);
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

export function createWindow(opts) {
  const w = new SandboxWindow(opts);
  state.windows.push(w);
  container.appendChild(w.el);
  return w;
}

function openNewWindow() {
  const sb = createSandbox();
  if (!sb) return null;
  const offset = (state.windows.length % 8) * 36;
  const left = Math.min(16 + offset, Math.max(8, window.innerWidth - 475 - 8));
  const top = Math.min(16 + offset, Math.max(8, window.innerHeight - 220 - 8));
  const win = createWindow({ left, top });
  win.addTab(sb);
  sb.activate();
  writeLayout();
  return sb;
}

export function removeSandbox(sb) {
  if (state.sandboxes.size <= 1) return;
  iframe.contentWindow.postMessage({ type: MessageTypes.REMOVE_SANDBOX, sandboxId: sb.id }, getTargetOrigin());
  pendingRuns.delete(sb.id);
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

addSandboxBtn.addEventListener("click", () => {
  const sb = openNewWindow();
  if (sb) sb.cm.focus();
});

// ====================================================
// EJECUCIÓN (exports)
// ====================================================
export function runSandbox(sb) {
  if (errorToast) errorToast.classList.remove("visible");

  const code = sb.cm.getValue();
  if (!engineReady) pendingRuns.add(sb.id);
  else runCode(sb, code);

  const cursor = sb.cm.getCursor();
  let startLine = cursor.line, endLine = cursor.line;
  while (startLine > 0 && sb.cm.getLine(startLine - 1).trim() !== "") startLine--;
  const lastLine = sb.cm.lineCount() - 1;
  while (endLine < lastLine && sb.cm.getLine(endLine + 1).trim() !== "") endLine++;

  for (let i = startLine; i <= endLine; i++) sb.cm.addLineClass(i, "background", "flash-line");
  setTimeout(() => {
    for (let i = startLine; i <= endLine; i++) sb.cm.removeLineClass(i, "background", "flash-line");
  }, 400);
}

function runCode(sb, code) {
  sb.clearChainMarks();

  setGlobalPauseUI(false);
  sb.paused = false; sb.syncUI();

  let transpiled = code;
  try {
    const blocks = parseBlocks(code);
    if (blocks.length > 1) {
      showError(`[Sandbox ${sb.label}] Solo se permite una secuencia continua por sandbox. Une los bloques con '>'`);
      return;
    }
    if (blocks.length === 1) {
      const b = blocks[0];
      transpiled = code.slice(0, b.start) + transpileBlock(b) + code.slice(b.end);
    }
  } catch (err) {
    showError(`[Sandbox ${sb.label}] ${err.message}`);
    return;
  }

  const configuracionOculta = `
    clear();
    pause(false);
  `;

  const codigoFinal = configuracionOculta + "\n" + transpiled;
  const order = sortedByLabel().indexOf(sb);
  iframe.contentWindow.postMessage({ type: MessageTypes.EXECUTE, sandboxId: sb.id, order, code: codigoFinal }, getTargetOrigin());
}

export function runAll() {
  if (errorToast) errorToast.classList.remove("visible");
  for (const sb of sortedByLabel()) {
    if (!engineReady) pendingRuns.add(sb.id);
    else runCode(sb, sb.cm.getValue());
  }
}
if (runAllBtn) runAllBtn.addEventListener("click", runAll);

// ====================================================
// MENSAJES DEL MOTOR
// ====================================================
window.addEventListener("message", (e) => {
  if (e.source !== iframe.contentWindow) return;
  const d = e.data;
  if (!d || !d.type) return;

  if (d.type === MessageTypes.READY) {
    engineReady = true;
    for (const id of [...pendingRuns]) {
      const sb = state.sandboxes.get(id);
      if (sb) runCode(sb, sb.cm.getValue());
    }
    pendingRuns.clear();
    return;
  }

  const sb = state.sandboxes.get(d.sandboxId);

  if (d.type === MessageTypes.ERROR) {
    const msg = String(d.message || "").split("\n")[0];
    showError(sb ? `[Sandbox ${sb.label}] ${msg}` : msg, 6000);
    return;
  }

  if (!sb) return;

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
});

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
          if (str[j] === sc && str[j-1] !== '\\') { j++; break; }
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

// ====================================================
// ATAJOS GLOBALES
// ====================================================
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); if (e.shiftKey) runAll(); else if (state.activeSandbox) runSandbox(state.activeSandbox); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (state.activeSandbox) state.activeSandbox.toggleSave(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") { e.preventDefault(); if (globalPauseBtn) globalPauseBtn.click(); }
  if (e.key === "Escape") { e.preventDefault(); if (state.activeSandbox && state.activeSandbox.win) state.activeSandbox.win.toggleMinimized(); }
});

if (globalPauseBtn) {
  globalPauseBtn.addEventListener("click", () => {
    setGlobalPauseUI(!isGlobalPaused);
    iframe.contentWindow.postMessage({ type: MessageTypes.PAUSE, paused: isGlobalPaused }, getTargetOrigin());
  });
}

// ====================================================
// INICIO
// ====================================================
on("REMOVE_SANDBOX", removeSandbox);

function init() {
  iframe.srcdoc = buildPreviewHtml();

  let restored = 0;
  const layout = readLayout();
  if (layout) {
    for (const w of layout.windows) {
      if (!w || !Array.isArray(w.tabs)) continue;
      let win = null;
      for (const t of w.tabs) {
        if (restored >= MAX_SANDBOXES) break;
        if (!t || typeof t.id !== "string" || state.sandboxes.has(t.id)) continue;
        const stored = ls.get(codeKey(t.id));
        if (stored === null) continue;
        const sb = createSandbox({ id: t.id, label: t.label, code: stored, hasStored: true });
        if (!sb) continue;
        if (!win) {
          win = createWindow({
            left: Math.max(8, Math.min(window.innerWidth - 120, Number(w.left) || 16)),
            top: Math.max(8, Math.min(window.innerHeight - 60, Number(w.top) || 16)),
            width: w.width || "", height: w.height || ""
          });
        }
        win.addTab(sb);
        sb.markSaved();
        pendingRuns.add(sb.id);
        restored++;
      }
      if (win) {
        const act = win.tabs.find(t => t.id === w.active) || win.tabs[0];
        win.selectTab(act);
        if (w.minimized) win.toggleMinimized();
      }
    }
  }

  const legacy = ls.get(LEGACY_KEY);
  if (restored === 0) {
    const first = createSandbox({ id: "default", label: 1, code: legacy || "", hasStored: legacy !== null });
    const win = createWindow({ left: 16, top: 16 });
    win.addTab(first);
    if (legacy !== null) {
      ls.set(codeKey(first.id), legacy);
      first.markSaved();
      writeLayout();
      ls.remove(LEGACY_KEY);
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

init();
