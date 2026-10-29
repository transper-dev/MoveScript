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
const LEGACY_KEY = "movescript_saved_code";   // esquema antiguo (un solo editor)
const LIST_KEY = "movescript_sandboxes";      // { windows: [{ left, top, width, height, minimized, tabs: [{id,label}], active }] }
const codeKey = (id) => `movescript_sandbox_${id}`;

// localStorage con protección (modo privado, cuota, etc.)
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { console.warn("No se pudo guardar", e); } },
  remove(k) { try { localStorage.removeItem(k); } catch (e) { /* nada */ } }
};

const sandboxes = new Map();      // sandboxId -> Sandbox (una pestaña), esté en la ventana que esté
const windows = [];               // SandboxWindow[]
const pendingRuns = new Set();    // sandboxIds a ejecutar cuando el motor esté listo
let activeSandbox = null;
let engineReady = false;
let isGlobalPaused = false;
let zCounter = 1;
let errorTimeout;

// Compatibilidad: sidebar de ayuda y cajón de BVH usan window.editor => CodeMirror del sandbox ACTIVO
Object.defineProperty(window, "editor", {
  get: () => (activeSandbox ? activeSandbox.cm : null),
  configurable: true
});
window.runActiveSandbox = () => { if (activeSandbox) runSandbox(activeSandbox); };

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

const isNewBlock = (lines, idx) => {
  if (!lines[idx].trim().startsWith("[")) return false;
  let prev = idx - 1;
  while (prev >= 0 && lines[prev].trim() === "") prev--;
  if (prev >= 0 && lines[prev].trim().endsWith(">")) return false; // continuación, no cortamos
  return true;
};

const sortedByLabel = () => [...sandboxes.values()].sort((a, b) => a.label - b.label);

// ====================================================
// Sandbox: una PESTAÑA (editor + estado). Vive dentro de una SandboxWindow.
// ====================================================
class Sandbox {
  constructor(id, label, { code = "", hasStored = false } = {}) {
    this.id = id;
    this.label = label;
    this.win = null;
    this.activeChainMarks = {};
    this.currentChainSteps = {};
    this.colorWidgets = [];
    this.colorUpdateTimer = null;
    this.isRigSelected = false;
    this.isSaved = false;
    this.dirty = false;          // editado desde el último guardado
    this.paused = false;         // pausa local
    this.hasStored = hasStored;  // hay código guardado en localStorage

    // El holder permite mover el editor entero entre ventanas
    this.holder = document.createElement("div");
    this.holder.className = "sb-editor";
    const textarea = document.createElement("textarea");
    textarea.spellcheck = false;
    this.holder.appendChild(textarea);
    this.cm = CodeMirror.fromTextArea(textarea, {
      mode: "javascript",
      theme: "monokai",
      lineNumbers: false,
      lineWrapping: true,
      matchBrackets: true
    });
    this.cm.setValue(code);

    // Pestaña
    this.tabEl = document.createElement("div");
    this.tabEl.className = "sb-tab";
    this.tabEl.innerHTML =
      `<i class="fas fa-pause sb-tab-pause"></i>` +
      `<span class="sb-tab-title">Sandbox ${label}</span>` +
      `<button class="sb-tab-close" title="Cerrar sandbox">&times;</button>`;

    this._wireCodeMirror();
    this._wireTab();
    this.updateColorWidgets();
  }

  // ---------- activación ----------
  activate() {
    const w = this.win;
    if (activeSandbox && activeSandbox.win && activeSandbox.win !== w) {
      activeSandbox.win.el.classList.remove("active");
    }
    activeSandbox = this;
    if (w) {
      w.el.classList.add("active");
      w.el.style.zIndex = ++zCounter;
      if (w.activeSb !== this) w.selectTab(this);
    }
  }

  // ---------- CodeMirror ----------
  _wireCodeMirror() {
    this.cm.on("focus", () => this.activate());

    this.cm.on("keydown", (cm, e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault(); e.stopPropagation(); this.toggleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault(); e.stopPropagation(); globalPauseBtn.click();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault(); e.stopPropagation();
        if (e.shiftKey) runAll(); else runSandbox(this);
      }
      if (this.isRigSelected && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault(); e.stopPropagation();
        iframe.contentWindow.postMessage({ type: "remoteKey", sandboxId: this.id, key: e.key, shiftKey: e.shiftKey }, "*");
      }
    });

    this.cm.on("change", () => {
      this.isSaved = false;
      this.dirty = true;
      this.syncUI();
      clearTimeout(this.colorUpdateTimer);
      this.colorUpdateTimer = setTimeout(() => this.updateColorWidgets(), 200);
    });
  }

  // ---------- pestaña (clic, arrastre, cerrar) ----------
  _wireTab() {
    this.tabEl.addEventListener("pointerdown", (e) => {
      if (e.button === 1) { e.preventDefault(); return; }         // clic central: se cierra en auxclick
      if (e.button !== 0 || e.target.closest(".sb-tab-close")) return;
      this.activate();
      startTabGesture(e, this);
    });
    this.tabEl.addEventListener("auxclick", (e) => { if (e.button === 1) removeSandbox(this); });
    this.tabEl.querySelector(".sb-tab-close").addEventListener("click", (e) => {
      e.stopPropagation();
      removeSandbox(this);
    });
  }

  // Refleja el estado en la pestaña y, si es la activa, en la barra de la ventana
  syncUI() {
    this.tabEl.classList.toggle("dirty", this.dirty);
    this.tabEl.classList.toggle("paused", this.paused);
    if (this.win) this.win.syncToolbar(this);
  }

  // ---------- guardar ----------
  markSaved() { this.isSaved = true; this.dirty = false; this.syncUI(); }

  toggleSave() {
    if (this.isSaved) {
      ls.remove(codeKey(this.id));
      this.hasStored = false;
      this.isSaved = false; this.dirty = false; this.syncUI();
    } else {
      ls.set(codeKey(this.id), this.cm.getValue());
      this.hasStored = true;
      this.markSaved();
    }
    writeLayout();
  }

  // ---------- pausa local ----------
  setPaused(value) {
    this.paused = !!value;
    this.syncUI();
    iframe.contentWindow.postMessage({ type: "pauseSandbox", sandboxId: this.id, paused: this.paused }, "*");
  }
  togglePause() { this.setPaused(!this.paused); }

  // ---------- widgets de color ----------
  updateColorWidgets() {
    this.colorWidgets.forEach(w => w.clear());
    this.colorWidgets = [];

    const colorRegex = /(["'])(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})|red|blue|green|yellow|cyan|magenta|white|black|pink|orange|purple|gray)\1/gi;
    const lineCount = this.cm.lineCount();

    for (let i = 0; i < lineCount; i++) {
      const lineText = this.cm.getLine(i);
      let match;
      while ((match = colorRegex.exec(lineText)) !== null) {
        const colorBox = document.createElement("span");
        colorBox.className = "color-widget";
        colorBox.style.backgroundColor = match[2];
        this.colorWidgets.push(this.cm.setBookmark({ line: i, ch: match.index }, { widget: colorBox }));
      }
    }
  }

  // ---------- resaltado del paso activo de la cadena ----------
  clearChainMarks() {
    Object.values(this.activeChainMarks).forEach(m => { if (m && m.clear) m.clear(); });
    this.activeChainMarks = {};
  }

  highlightStep(codeIndex, step) {
    const lines = this.cm.getValue().split("\n");
    let currentIdx = 0, blockStartLine = -1;

    for (let i = 0; i < lines.length; i++) {
      if (isNewBlock(lines, i)) {
        if (currentIdx === codeIndex) { blockStartLine = i; break; }
        currentIdx++;
      }
    }
    if (blockStartLine === -1) return;

    let currentStep = 0;
    let startPos = null, endPos = null;
    let l = blockStartLine;
    let c = lines[l].indexOf("[");

    while (l < lines.length) {
      const lineStr = lines[l];
      while (c < lineStr.length) {
        const char = lineStr[c];
        if (char === "[") {
          if (currentStep === step) startPos = { line: l, ch: c };
        } else if (char === "]") {
          if (currentStep === step) { endPos = { line: l, ch: c + 1 }; break; }
        } else if (char === ">") {
          if (currentStep < step) currentStep++;
        }
        c++;
      }
      if (endPos) break;
      l++; c = 0;
      if (l < lines.length && isNewBlock(lines, l)) break;
    }

    if (startPos && endPos) {
      if (this.activeChainMarks[codeIndex]) this.activeChainMarks[codeIndex].clear();
      this.activeChainMarks[codeIndex] = this.cm.markText(startPos, endPos, { className: "chain-active-text" });
    }
  }

  // ---------- edición del código desde la escena (mover/rotar) ----------
  updateEditor(codeIndex, modifierCallback) {
    const code = this.cm.getValue();
    const lines = code.split("\n");
    let currentIdx = 0, charCount = 0;

    for (let i = 0; i < lines.length; i++) {
      if (isNewBlock(lines, i)) {
        if (currentIdx === codeIndex) {
          const start = charCount;
          let j = i, end = charCount + lines[i].length;
          while (j < lines.length && !lines[j].includes(";")) {
            j++;
            if (j < lines.length) {
              if (isNewBlock(lines, j)) break;
              end += 1 + lines[j].length;
            }
          }

          let statement = code.substring(start, end);
          const bIdx = statement.indexOf("]");
          const startPos = this.cm.posFromIndex(start);
          const endPos = this.cm.posFromIndex(end);

          if (modifierCallback && bIdx !== -1) {
            statement = modifierCallback(statement, bIdx);
            this.cm.replaceRange(statement, startPos, endPos);
            if (this.currentChainSteps[codeIndex] !== undefined) {
              this.highlightStep(codeIndex, this.currentChainSteps[codeIndex]);
            }
          } else {
            this.cm.setSelection(startPos, endPos);
          }
          return;
        }
        currentIdx++;
      }
      charCount += lines[i].length + 1;
    }
  }

  destroy() {
    clearTimeout(this.colorUpdateTimer);
    this.clearChainMarks();
    this.colorWidgets.forEach(w => w.clear());
    this.tabEl.remove();
    this.holder.remove();
  }
}

// ====================================================
// SandboxWindow: ventana flotante con barra de pestañas (1..n sandboxes apilados)
// ====================================================
class SandboxWindow {
  constructor({ left = 16, top = 16, width = "", height = "" } = {}) {
    this.tabs = [];
    this.activeSb = null;
    this.prevSize = null;

    this.el = document.createElement("div");
    this.el.className = "sandbox";
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
    if (width) this.el.style.width = width;
    if (height) this.el.style.height = height;
    this.el.style.zIndex = ++zCounter;
    this.el.innerHTML = `
      <div class="sb-bar">
        <div class="sb-tabs"></div>
        <button class="sb-btn sb-icon sb-addtab" title="Nueva pestaña"><i class="fas fa-plus"></i></button>
        <div class="sb-actions">
          <button class="sb-btn sb-icon sb-run" title="Ejecutar (Ctrl+Enter)"><i class="fas fa-play"></i></button>
          <button class="sb-btn sb-icon sb-pause" title="Pausar este sandbox"><i class="fas fa-pause"></i></button>
          <button class="sb-btn sb-icon sb-save" title="Guardar (Ctrl+S)"><i class="fas fa-save"></i></button>
          <button class="sb-btn sb-icon sb-toggle" title="Ocultar (Esc)"><i class="fas fa-minus"></i></button>
        </div>
      </div>
      <div class="sb-body"></div>
      <div class="sb-resize"></div>`;

    this.barEl = this.el.querySelector(".sb-bar");
    this.tabsEl = this.el.querySelector(".sb-tabs");
    this.bodyEl = this.el.querySelector(".sb-body");
    this.addBtn = this.el.querySelector(".sb-addtab");
    this.runBtn = this.el.querySelector(".sb-run");
    this.pauseBtn = this.el.querySelector(".sb-pause");
    this.saveBtn = this.el.querySelector(".sb-save");
    this.toggleBtn = this.el.querySelector(".sb-toggle");
    this.resizeHandle = this.el.querySelector(".sb-resize");

    this.el.addEventListener("pointerdown", () => { if (this.activeSb) this.activeSb.activate(); }, true);
    this.addBtn.addEventListener("click", () => {
      const sb = createSandbox();
      if (!sb) return;
      this.addTab(sb);
      sb.activate();
      sb.cm.focus();
      scheduleLayoutSave();
    });
    this.runBtn.addEventListener("click", () => { if (this.activeSb) runSandbox(this.activeSb); });
    this.pauseBtn.addEventListener("click", () => { if (this.activeSb) this.activeSb.togglePause(); });
    this.saveBtn.addEventListener("click", () => { if (this.activeSb) this.activeSb.toggleSave(); });
    this.toggleBtn.addEventListener("click", () => this.toggleMinimized());

    this._wireBarDrag();
    this._wireResize();
  }

  // ---------- pestañas ----------
  addTab(sb, index = this.tabs.length) {
    index = Math.max(0, Math.min(index, this.tabs.length));
    sb.win = this;
    this.tabs.splice(index, 0, sb);
    this.tabsEl.insertBefore(sb.tabEl, this.tabsEl.children[index] || null);
    sb.holder.style.display = "none";
    this.bodyEl.appendChild(sb.holder);
    this.selectTab(sb);
    sb.syncUI();
  }

  // Saca la pestaña de esta ventana (NO destruye el sandbox)
  detachTab(sb) {
    const i = this.tabs.indexOf(sb);
    if (i < 0) return;
    this.tabs.splice(i, 1);
    sb.tabEl.remove();
    sb.holder.remove();
    sb.win = null;
    if (this.activeSb === sb) {
      this.activeSb = null;
      const next = this.tabs[Math.min(i, this.tabs.length - 1)];
      if (next) this.selectTab(next);
    }
  }

  selectTab(sb) {
    this.activeSb = sb;
    for (const t of this.tabs) {
      const on = t === sb;
      t.tabEl.classList.toggle("active", on);
      t.holder.style.display = on ? "" : "none";
    }
    sb.cm.refresh();
    this.syncToolbar(sb);
    try { sb.tabEl.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e) { /* nada */ }
  }

  // Reordena arrastrando dentro de la misma barra
  reorderByX(sb, x) {
    const cur = this.tabs.indexOf(sb);
    let pos = this.tabs.length;
    for (let i = 0; i < this.tabs.length; i++) {
      const r = this.tabs[i].tabEl.getBoundingClientRect();
      if (x < r.left + r.width / 2) { pos = i; break; }
    }
    if (pos > cur) pos--;
    if (pos === cur) return;
    this.tabs.splice(cur, 1);
    this.tabs.splice(pos, 0, sb);
    this.tabs.forEach(t => this.tabsEl.appendChild(t.tabEl));
  }

  indexForX(x) {
    for (let i = 0; i < this.tabs.length; i++) {
      const r = this.tabs[i].tabEl.getBoundingClientRect();
      if (x < r.left + r.width / 2) return i;
    }
    return this.tabs.length;
  }

  hitBar(x, y) {
    const r = this.barEl.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }
  setDrop(on) { this.barEl.classList.toggle("drop-target", on); }

  // ---------- barra de acciones (actúa sobre la pestaña activa) ----------
  syncToolbar(sb = this.activeSb) {
    if (!sb || sb !== this.activeSb) return;
    this.saveBtn.classList.toggle("saved", sb.isSaved);
    this.saveBtn.classList.toggle("dirty", sb.dirty);
    this.saveBtn.title = sb.isSaved
      ? "Guardado: clic para quitar el guardado (Ctrl+S)"
      : (sb.dirty ? "Guardar cambios (Ctrl+S)" : "Guardar (Ctrl+S)");

    const icon = this.pauseBtn.querySelector("i");
    if (icon) icon.className = sb.paused ? "fas fa-play-circle" : "fas fa-pause";
    this.pauseBtn.classList.toggle("paused", sb.paused);
    this.pauseBtn.title = sb.paused ? "Reanudar este sandbox" : "Pausar este sandbox";
  }

  // ---------- minimizar ----------
  toggleMinimized() {
    if (this.el.classList.toggle("minimized")) {
      this.prevSize = { width: this.el.style.width || "", height: this.el.style.height || "" };
      this.el.style.height = this.barEl.offsetHeight + "px";
      this.toggleBtn.innerHTML = '<i class="fas fa-expand-alt"></i>';
      this.toggleBtn.title = "Mostrar (Esc)";
    } else {
      this.el.style.width = this.prevSize?.width || "";
      this.el.style.height = this.prevSize?.height || "";
      this.toggleBtn.innerHTML = '<i class="fas fa-minus"></i>';
      this.toggleBtn.title = "Ocultar (Esc)";
      if (this.activeSb) this.activeSb.cm.refresh();
    }
    scheduleLayoutSave();
  }

  sizeStrings() {
    if (this.el.classList.contains("minimized")) return this.prevSize || { width: "", height: "" };
    return { width: this.el.style.width, height: this.el.style.height };
  }

  // ---------- posición / tamaño ----------
  moveTo(x, y) {
    this.el.style.left = `${Math.max(8, Math.min(window.innerWidth - this.el.offsetWidth - 8, x))}px`;
    this.el.style.top = `${Math.max(8, Math.min(window.innerHeight - this.el.offsetHeight - 8, y))}px`;
  }

  _wireBarDrag() {
    let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
    this.barEl.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest(".sb-tab, button")) return;
      dragging = true; this.barEl.setPointerCapture(e.pointerId);
      const rect = this.el.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY; startLeft = rect.left; startTop = rect.top;
    });
    this.barEl.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      this.moveTo(startLeft + (e.clientX - startX), startTop + (e.clientY - startY));
    });
    const stop = () => { if (dragging) scheduleLayoutSave(); dragging = false; };
    this.barEl.addEventListener("pointerup", stop);
    this.barEl.addEventListener("pointercancel", stop);
  }

  _wireResize() {
    let resizing = false, startW = 0, startH = 0, startRX = 0, startRY = 0;
    this.resizeHandle.addEventListener("pointerdown", (e) => {
      resizing = true; this.resizeHandle.setPointerCapture(e.pointerId);
      startW = this.el.offsetWidth; startH = this.el.offsetHeight;
      startRX = e.clientX; startRY = e.clientY; e.preventDefault();
    });
    this.resizeHandle.addEventListener("pointermove", (e) => {
      if (!resizing) return;
      this.el.style.width = `${Math.max(420, Math.min(window.innerWidth - 16, startW + (e.clientX - startRX)))}px`;
      this.el.style.height = `${Math.max(220, Math.min(window.innerHeight - 16, startH + (e.clientY - startRY)))}px`;
    });
    const stop = () => { if (resizing) scheduleLayoutSave(); resizing = false; };
    this.resizeHandle.addEventListener("pointerup", stop);
    this.resizeHandle.addEventListener("pointercancel", stop);
  }

  // Solo se persisten las pestañas con código guardado
  getLayout() {
    const stored = this.tabs.filter(t => t.hasStored);
    if (stored.length === 0) return null;
    const size = this.sizeStrings();
    const active = this.activeSb && this.activeSb.hasStored ? this.activeSb : stored[0];
    return {
      left: parseInt(this.el.style.left, 10) || 0,
      top: parseInt(this.el.style.top, 10) || 0,
      width: size.width || "",
      height: size.height || "",
      minimized: this.el.classList.contains("minimized"),
      tabs: stored.map(t => ({ id: t.id, label: t.label })),
      active: active.id
    };
  }

  destroy() {
    const i = windows.indexOf(this);
    if (i >= 0) windows.splice(i, 1);
    this.el.remove();
  }
}

function createWindow(opts) {
  const w = new SandboxWindow(opts);
  windows.push(w);
  container.appendChild(w.el);
  return w;
}

// ====================================================
// ARRASTRE DE PESTAÑAS (reordenar / sacar a nueva ventana / apilar en otra)
// ====================================================
function startTabGesture(e, sb) {
  const startX = e.clientX, startY = e.clientY;
  let mode = "pending";   // pending -> reorder (varias pestañas) | move (ventana de una pestaña)
  let moving = null, offX = 0, offY = 0, dropTarget = null, lastX = startX;

  document.body.classList.add("dragging"); // el iframe deja de capturar el ratón

  const setDrop = (target) => {
    if (target === dropTarget) return;
    if (dropTarget) dropTarget.setDrop(false);
    dropTarget = target;
    if (dropTarget) dropTarget.setDrop(true);
  };

  const onMove = (ev) => {
    lastX = ev.clientX;

    if (mode === "pending") {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
      const w = sb.win;
      if (w.tabs.length > 1) {
        mode = "reorder";
      } else {
        mode = "move"; moving = w;
        const r = w.el.getBoundingClientRect();
        offX = startX - r.left; offY = startY - r.top;
        w.el.classList.add("ghost");
      }
    }

    if (mode === "reorder") {
      const w = sb.win;
      const strip = w.barEl.getBoundingClientRect();
      const outside = ev.clientY < strip.top - 28 || ev.clientY > strip.bottom + 28 ||
        ev.clientX < strip.left - 40 || ev.clientX > strip.right + 40;
      if (!outside) { w.reorderByX(sb, ev.clientX); return; }

      // Sacar la pestaña a una ventana nueva que sigue al puntero
      const size = w.sizeStrings();
      w.detachTab(sb);
      moving = createWindow({ left: ev.clientX - 60, top: ev.clientY - 18, width: size.width, height: size.height });
      moving.addTab(sb);
      moving.el.classList.add("ghost");
      sb.activate();
      offX = 60; offY = 18;
      mode = "move";
    }

    if (mode === "move") {
      moving.moveTo(ev.clientX - offX, ev.clientY - offY);
      const target = windows.find(w => w !== moving && w.hitBar(ev.clientX, ev.clientY)) || null;
      setDrop(target);
    }
  };

  const finish = (apply) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    document.body.classList.remove("dragging");

    if (mode === "move" && moving) {
      moving.el.classList.remove("ghost");
      const target = dropTarget;
      setDrop(null);
      if (apply && target && windows.includes(target) && moving.tabs.length === 1) {
        // Apilar: la pestaña pasa a la ventana destino y la ventana de origen desaparece
        const index = target.indexForX(lastX);
        moving.detachTab(sb);
        moving.destroy();
        target.addTab(sb, index);
        sb.activate();
      } else {
        sb.activate();
      }
    }
    writeLayout();
  };
  const onUp = () => finish(true);
  const onCancel = () => finish(false);

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
}

// ====================================================
// PERSISTENCIA
// ====================================================
let layoutTimer = null;

function writeLayout() {
  clearTimeout(layoutTimer);
  const wins = windows.map(w => w.getLayout()).filter(Boolean);
  if (wins.length === 0) ls.remove(LIST_KEY);
  else ls.set(LIST_KEY, JSON.stringify({ windows: wins }));
}
function scheduleLayoutSave() {
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(writeLayout, 300);
}
function readLayout() {
  let o = null;
  try { o = JSON.parse(ls.get(LIST_KEY)); } catch (e) { return null; }
  if (!o) return null;
  if (Array.isArray(o.windows)) return o;
  // Formato anterior (una ventana por sandbox): se migra a ventanas de una pestaña
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
// CREAR / ELIMINAR
// ====================================================
function refreshOnlyOne() {
  document.body.classList.toggle("only-one", sandboxes.size <= 1);
}

// Etiquetas "Sandbox N": se reutiliza el menor número libre
const labelInUse = (n) => [...sandboxes.values()].some(sb => sb.label === n);
function nextFreeLabel() {
  let n = 1;
  while (labelInUse(n)) n++;
  return n;
}

function createSandbox({ id, label, code = "", hasStored = false } = {}) {
  if (sandboxes.size >= MAX_SANDBOXES) {
    showError(`Máximo ${MAX_SANDBOXES} sandboxes a la vez.`);
    return null;
  }
  let lbl = Number(label);
  if (!Number.isInteger(lbl) || lbl < 1 || labelInUse(lbl)) lbl = nextFreeLabel();
  let sbId = id || `s${lbl}`;
  while (sandboxes.has(sbId)) sbId += "_";

  const sb = new Sandbox(sbId, lbl, { code, hasStored });
  sandboxes.set(sbId, sb);
  refreshOnlyOne();
  return sb;
}

// Nueva ventana (escalonada) con un sandbox nuevo
function openNewWindow() {
  const sb = createSandbox();
  if (!sb) return null;
  const offset = (windows.length % 8) * 36;
  const left = Math.min(16 + offset, Math.max(8, window.innerWidth - 475 - 8));
  const top = Math.min(16 + offset, Math.max(8, window.innerHeight - 220 - 8));
  const win = createWindow({ left, top });
  win.addTab(sb);
  sb.activate();
  writeLayout();
  return sb;
}

function removeSandbox(sb) {
  if (sandboxes.size <= 1) return; // siempre queda al menos uno
  // El motor destruye los rigs, trails y timers de este sandbox
  iframe.contentWindow.postMessage({ type: "removeSandbox", sandboxId: sb.id }, "*");
  pendingRuns.delete(sb.id);
  sandboxes.delete(sb.id);
  ls.remove(codeKey(sb.id));

  const win = sb.win;
  const wasActive = activeSandbox === sb;
  if (win) {
    win.detachTab(sb);
    if (win.tabs.length === 0) win.destroy();
  }
  sb.destroy();

  if (wasActive) {
    activeSandbox = null;
    const w = (win && windows.includes(win)) ? win : windows[windows.length - 1];
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
// EJECUCIÓN
// ====================================================
function runSandbox(sb) {
  if (errorToast) errorToast.classList.remove("visible");

  const code = sb.cm.getValue();
  if (!engineReady) pendingRuns.add(sb.id);
  else runCode(sb, code);

  // Destello de las líneas del párrafo actual
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

  // Run reanuda la reproducción global y la de ESTE sandbox (y sincroniza los botones)
  setGlobalPauseUI(false);
  sb.paused = false; sb.syncUI();

  // 1. VALIDACIÓN SINTAXIS: prevenir [].modificador()
  if (/\]\s*\./.test(code)) {
    showError(`[Sandbox ${sb.label}] Error de sintaxis: No uses punto '.' después del bloque. Usa el pipe '>'`);
    return;
  }

  // 2. VALIDACIÓN LÓGICA: una única secuencia continua por sandbox
  const numBloques = (code.match(/(?:\[[\s\S]*?\](?:\s*>\s*\[[\s\S]*?\])*)/g) || []).length;
  if (numBloques > 1) {
    showError(`[Sandbox ${sb.label}] Solo se permite una secuencia continua por sandbox. Une los bloques con >`);
    return;
  }

  const transpiled = code.replace(/(?:\[[\s\S]*?\](?:\s*>\s*\[[\s\S]*?\])*)/g, (match) => {
    const parts = match.split(">");
    const cleanedParts = parts.map(p => {
      const inside = p.trim().replace(/^\[/, "").replace(/\]$/, "").trim();
      return inside === "" ? `$B()` : `$B().${inside}`;
    });
    return `CHAIN(${cleanedParts.join(", ")})`;
  });

  // clear() limpia SOLO este sandbox; grid/cámara/fondo son globales y no se reinician
  const configuracionOculta = `
    clear();
    pause(false);
  `;

  const codigoFinal = configuracionOculta + "\n" + transpiled;
  console.log(`Código final a ejecutar (sandbox ${sb.id}):\n`, codigoFinal);
  // order = posición por número de sandbox (independiente de en qué ventana esté); define la X por defecto
  const order = sortedByLabel().indexOf(sb);
  iframe.contentWindow.postMessage({ type: "execute", sandboxId: sb.id, order, code: codigoFinal }, "*");
}

// Ejecuta todos los sandboxes por orden de número
function runAll() {
  if (errorToast) errorToast.classList.remove("visible");
  for (const sb of sortedByLabel()) {
    if (!engineReady) pendingRuns.add(sb.id);
    else runCode(sb, sb.cm.getValue());
  }
}
if (runAllBtn) runAllBtn.addEventListener("click", runAll);

// ====================================================
// MENSAJES DEL MOTOR (enrutados por sandboxId)
// ====================================================
window.addEventListener("message", (e) => {
  const d = e.data;
  if (!d || !d.type) return;

  if (d.type === "ready") {
    engineReady = true;
    for (const id of [...pendingRuns]) {
      const sb = sandboxes.get(id);
      if (sb) runCode(sb, sb.cm.getValue());
    }
    pendingRuns.clear();
    return;
  }

  if (d.type === "globalHotkey") {
    if (d.key === "enter" && activeSandbox) runSandbox(activeSandbox);
    if (d.key === "s" && activeSandbox) activeSandbox.toggleSave();
    if (d.key === "p" && globalPauseBtn) globalPauseBtn.click();
    return;
  }

  const sb = sandboxes.get(d.sandboxId);

  if (d.type === "error") {
    const msg = String(d.message || "").split("\n")[0];
    showError(sb ? `[Sandbox ${sb.label}] ${msg}` : msg, 6000);
    return;
  }

  if (!sb) return; // mensaje de un sandbox ya eliminado

  if (d.type === "rigMoved") {
    sb.updateEditor(d.codeIndex, (st, bIdx) => {
      const inside = st.substring(0, bIdx).replace(/\.pos\([^)]+\)/g, "").replace(/\.x\([^)]+\)/g, "").replace(/\.z\([^)]+\)/g, "");
      return inside + `.pos(${Math.round(d.x)}, 0, ${Math.round(d.z)})` + st.substring(bIdx);
    });
  } else if (d.type === "rigRotated") {
    sb.updateEditor(d.codeIndex, (st, bIdx) => {
      const inside = st.substring(0, bIdx).replace(/\.rotX\([^)]+\)/g, "").replace(/\.rotY\([^)]+\)/g, "");
      let rStr = "";
      if (Math.abs(d.rotX) > 0.01) rStr += `.rotX(${d.rotX.toFixed(2)})`;
      if (Math.abs(d.rotY) > 0.01) rStr += `.rotY(${d.rotY.toFixed(2)})`;
      return inside + rStr + st.substring(bIdx);
    });
  } else if (d.type === "rigSelected") {
    // Solo un rig seleccionado en toda la escena. activate() muestra su pestaña y sube su ventana.
    sandboxes.forEach(other => { if (other !== sb) other.isRigSelected = false; });
    sb.isRigSelected = true;
    sb.activate();
    sb.updateEditor(d.codeIndex, null);
  } else if (d.type === "rigDeselected") {
    sb.isRigSelected = false;
    const cursor = sb.cm.getCursor();
    sb.cm.setSelection(cursor, cursor);
  } else if (d.type === "chainStep") {
    sb.currentChainSteps[d.codeIndex] = d.step;
    sb.highlightStep(d.codeIndex, d.step);
  }
});

// ====================================================
// ATAJOS GLOBALES (actúan sobre el sandbox activo)
// ====================================================
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); if (e.shiftKey) runAll(); else if (activeSandbox) runSandbox(activeSandbox); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (activeSandbox) activeSandbox.toggleSave(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") { e.preventDefault(); if (globalPauseBtn) globalPauseBtn.click(); }
  if (e.key === "Escape") { e.preventDefault(); if (activeSandbox && activeSandbox.win) activeSandbox.win.toggleMinimized(); }
});

if (globalPauseBtn) {
  globalPauseBtn.addEventListener("click", () => {
    setGlobalPauseUI(!isGlobalPaused);
    iframe.contentWindow.postMessage({ type: "pause", paused: isGlobalPaused }, "*");
  });
}

// ====================================================
// INICIO
// ====================================================
function init() {
  iframe.srcdoc = buildPreviewHtml();

  // 1. Restaurar ventanas y pestañas guardadas (el código está en movescript_sandbox_<id>)
  let restored = 0;
  const layout = readLayout();
  if (layout) {
    for (const w of layout.windows) {
      if (!w || !Array.isArray(w.tabs)) continue;
      let win = null;
      for (const t of w.tabs) {
        if (restored >= MAX_SANDBOXES) break;
        if (!t || typeof t.id !== "string" || sandboxes.has(t.id)) continue;
        const stored = ls.get(codeKey(t.id));
        if (stored === null) continue; // entrada huérfana: sin código guardado
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

  // 2. Migración del key antiguo al primer sandbox ("default")
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
  } else if (windows.length > 0 && windows[0].activeSb) {
    windows[0].activeSb.activate();
  }
}
init();