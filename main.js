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
// ELEMENTOS GLOBALES (compartidos por todos los sandboxes)
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
const LIST_KEY = "movescript_sandboxes";      // { seq, items: [{ id, label, left, top, width, height, minimized }] }
const codeKey = (id) => `movescript_sandbox_${id}`;

// localStorage con protección (modo privado, cuota, etc.)
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { console.warn("No se pudo guardar", e); } },
  remove(k) { try { localStorage.removeItem(k); } catch (e) { /* nada */ } }
};

const sandboxes = new Map();      // sandboxId -> SandboxUI
const pendingRuns = new Set();    // sandboxIds a ejecutar cuando el motor esté listo
let activeSandbox = null;
let engineReady = false;
let isGlobalPaused = false;
let zCounter = 1;
let errorTimeout;

// Compatibilidad: el resto de la UI (sidebar de ayuda y cajón de BVH) usa window.editor.
// Ahora apunta siempre al CodeMirror del sandbox ACTIVO.
Object.defineProperty(window, "editor", {
  get: () => (activeSandbox ? activeSandbox.cm : null),
  configurable: true
});
window.runActiveSandbox = () => { if (activeSandbox) runSandbox(activeSandbox); };

function setGlobalPauseUI(paused) {
  isGlobalPaused = paused;
  if (!globalPauseBtn) return;
  const icon = globalPauseBtn.querySelector("i");
  if (icon) icon.className = paused ? "fas fa-play" : "fas fa-pause";
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

// ====================================================
// SandboxUI: un editor flotante independiente
// ====================================================
class SandboxUI {
  constructor(id, label, { code = "", left = 16, top = 16, width = "", height = "", hasStored = false } = {}) {
    this.id = id;
    this.label = label;
    this.activeChainMarks = {};
    this.currentChainSteps = {};
    this.colorWidgets = [];
    this.colorUpdateTimer = null;
    this.isRigSelected = false;
    this.isSaved = false;
    this.prevSize = null;
    this.hasStored = hasStored; // hay código guardado en localStorage para este sandbox
    this.dirty = false;         // editado desde el último guardado
    this.paused = false;        // pausa local de este sandbox

    this.el = document.createElement("div");
    this.el.className = "sandbox";
    this.el.dataset.sandboxId = id;
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
    if (width) this.el.style.width = width;
    if (height) this.el.style.height = height;
    this.el.innerHTML = `
      <div class="sb-bar">
        <span class="sb-title">Sandbox ${label}</span>
        <button class="sb-btn sb-icon sb-run" title="Ejecutar (Ctrl+Enter)"><i class="fas fa-play"></i></button>
        <button class="sb-btn sb-icon sb-pause" title="Pausar este sandbox"><i class="fas fa-pause"></i></button>
        <button class="sb-btn sb-icon sb-save" title="Guardar (Ctrl+S)"><i class="fas fa-save"></i></button>
        <button class="sb-btn sb-icon sb-toggle" title="Ocultar (Esc)">&minus;</button>
        <button class="sb-btn sb-icon sb-del" title="Eliminar sandbox">&times;</button>
      </div>
      <textarea spellcheck="false"></textarea>
      <div class="sb-resize"></div>`;
    container.appendChild(this.el);

    this.bar = this.el.querySelector(".sb-bar");
    this.runBtn = this.el.querySelector(".sb-run");
    this.toggleBtn = this.el.querySelector(".sb-toggle");
    this.saveBtn = this.el.querySelector(".sb-save");
    this.delBtn = this.el.querySelector(".sb-del");
    this.pauseBtn = this.el.querySelector(".sb-pause");
    this.resizeHandle = this.el.querySelector(".sb-resize");

    this.cm = CodeMirror.fromTextArea(this.el.querySelector("textarea"), {
      mode: "javascript",
      theme: "monokai",
      lineNumbers: false,
      lineWrapping: true,
      matchBrackets: true
    });
    this.cm.setValue(code);

    this._wireCodeMirror();
    this._wireButtons();
    this._wireDrag();
    this._wireResize();
    this.updateColorWidgets();
    this._renderToggle(false);
    this._renderPause();
    this._renderSave();
  }

  // ---------- activación ----------
  activate() {
    if (activeSandbox && activeSandbox !== this) activeSandbox.el.classList.remove("active");
    activeSandbox = this;
    this.el.classList.add("active");
    this.el.style.zIndex = ++zCounter;
  }

  // ---------- CodeMirror ----------
  _wireCodeMirror() {
    this.cm.on("focus", () => this.activate());
    this.el.addEventListener("pointerdown", () => this.activate(), true);

    this.cm.on("keydown", (cm, e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault(); e.stopPropagation(); this.saveBtn.click();
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
      this._renderSave();
      clearTimeout(this.colorUpdateTimer);
      this.colorUpdateTimer = setTimeout(() => this.updateColorWidgets(), 200);
    });
  }

  // ---------- botones ----------
  _wireButtons() {
    this.runBtn.addEventListener("click", () => runSandbox(this));
    this.toggleBtn.addEventListener("click", () => this.toggleMinimized());
    this.saveBtn.addEventListener("click", () => this.toggleSave());
    this.pauseBtn.addEventListener("click", () => this.togglePause());
    this.delBtn.addEventListener("click", () => removeSandbox(this));
  }

  toggleMinimized() {
    if (this.el.classList.toggle("minimized")) {
      this.prevSize = { width: this.el.style.width || "", height: this.el.style.height || "" };
      this.el.style.height = this.bar.offsetHeight + "px";
      this._renderToggle(true);
    } else {
      this.el.style.width = this.prevSize?.width || "";
      this.el.style.height = this.prevSize?.height || "";
      this._renderToggle(false);
      this.cm.refresh();
    }
    scheduleLayoutSave();
  }

  _renderToggle(minimized) {
    this.toggleBtn.textContent = minimized ? "+" : "\u2212";
    this.toggleBtn.title = minimized ? "Mostrar (Esc)" : "Ocultar (Esc)";
  }

  _renderSave() {
    this.saveBtn.classList.toggle("saved", this.isSaved);
    this.saveBtn.classList.toggle("dirty", this.dirty);
    this.saveBtn.title = this.isSaved
      ? "Guardado: clic para quitar el guardado (Ctrl+S)"
      : (this.dirty ? "Guardar cambios (Ctrl+S)" : "Guardar (Ctrl+S)");
  }

  markSaved() {
    this.isSaved = true; this.dirty = false; this._renderSave();
  }

  toggleSave() {
    if (this.isSaved) {
      ls.remove(codeKey(this.id));
      this.hasStored = false;
      this.isSaved = false; this.dirty = false; this._renderSave();
    } else {
      ls.set(codeKey(this.id), this.cm.getValue());
      this.hasStored = true;
      this.markSaved();
    }
    writeLayout();
  }

  // ---------- pausa local ----------
  _renderPause() {
    const icon = this.pauseBtn.querySelector("i");
    if (icon) icon.className = this.paused ? "fas fa-play" : "fas fa-pause";
    this.pauseBtn.classList.toggle("paused", this.paused);
    this.pauseBtn.title = this.paused ? "Reanudar este sandbox" : "Pausar este sandbox";
  }

  setPaused(value) {
    this.paused = !!value;
    this._renderPause();
    iframe.contentWindow.postMessage({ type: "pauseSandbox", sandboxId: this.id, paused: this.paused }, "*");
  }

  togglePause() { this.setPaused(!this.paused); }

  // Geometría actual (para restaurar al recargar)
  getLayout() {
    const minimized = this.el.classList.contains("minimized");
    const size = minimized ? this.prevSize : { width: this.el.style.width, height: this.el.style.height };
    return {
      id: this.id,
      label: this.label,
      left: parseInt(this.el.style.left, 10) || 0,
      top: parseInt(this.el.style.top, 10) || 0,
      width: size?.width || "",
      height: size?.height || "",
      minimized
    };
  }

  // ---------- arrastrar / redimensionar (por instancia) ----------
  _wireDrag() {
    let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
    this.bar.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      dragging = true; this.bar.setPointerCapture(e.pointerId);
      const rect = this.el.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY; startLeft = rect.left; startTop = rect.top;
    });
    this.bar.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      this.el.style.left = `${Math.max(8, Math.min(window.innerWidth - this.el.offsetWidth - 8, startLeft + (e.clientX - startX)))}px`;
      this.el.style.top = `${Math.max(8, Math.min(window.innerHeight - this.el.offsetHeight - 8, startTop + (e.clientY - startY)))}px`;
    });
    const stop = () => { if (dragging) scheduleLayoutSave(); dragging = false; };
    this.bar.addEventListener("pointerup", stop);
    this.bar.addEventListener("pointercancel", stop);
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

  // ---------- destrucción ----------
  destroy() {
    clearTimeout(this.colorUpdateTimer);
    this.clearChainMarks();
    this.colorWidgets.forEach(w => w.clear());
    this.el.remove();
  }
}

// ====================================================
// CREAR / ELIMINAR SANDBOXES
// ====================================================
function refreshOnlyOne() {
  document.body.classList.toggle("only-one", sandboxes.size <= 1);
}

// ---------- persistencia ----------
let layoutTimer = null;

function writeLayout() {
  clearTimeout(layoutTimer);
  const items = [...sandboxes.values()].filter(sb => sb.hasStored).map(sb => sb.getLayout());
  if (items.length === 0) ls.remove(LIST_KEY);
  else ls.set(LIST_KEY, JSON.stringify({ items }));
}
function scheduleLayoutSave() {
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(writeLayout, 300);
}
function readLayout() {
  try {
    const o = JSON.parse(ls.get(LIST_KEY));
    if (o && Array.isArray(o.items)) return o;
  } catch (e) { /* lista corrupta: se ignora */ }
  return null;
}
window.addEventListener("beforeunload", writeLayout);

// Etiquetas "Sandbox N": se reutiliza el menor número libre (si borras el 2, el siguiente nuevo es el 2)
const labelInUse = (n) => [...sandboxes.values()].some(sb => sb.label === n);
function nextFreeLabel() {
  let n = 1;
  while (labelInUse(n)) n++;
  return n;
}

function createSandbox({ id, label, code = "", layout = null, hasStored = false, activate = true } = {}) {
  if (sandboxes.size >= MAX_SANDBOXES) {
    showError(`Máximo ${MAX_SANDBOXES} sandboxes a la vez.`);
    return null;
  }
  let lbl = Number(label);
  if (!Number.isInteger(lbl) || lbl < 1 || labelInUse(lbl)) lbl = nextFreeLabel();
  let sbId = id || `s${lbl}`;
  while (sandboxes.has(sbId)) sbId += "_";

  let left, top, width = "", height = "";
  if (layout) {
    left = Math.max(8, Math.min(window.innerWidth - 120, Number(layout.left) || 16));
    top = Math.max(8, Math.min(window.innerHeight - 60, Number(layout.top) || 16));
    width = layout.width || ""; height = layout.height || "";
  } else {
    const offset = (sandboxes.size % 8) * 36; // escalonado para no solapar
    left = Math.min(16 + offset, Math.max(8, window.innerWidth - 475 - 8));
    top = Math.min(16 + offset, Math.max(8, window.innerHeight - 220 - 8));
  }

  const sb = new SandboxUI(sbId, lbl, { code, left, top, width, height, hasStored });
  sandboxes.set(sbId, sb);
  refreshOnlyOne();
  if (layout && layout.minimized) sb.toggleMinimized();
  if (activate) sb.activate();
  return sb;
}

function removeSandbox(sb) {
  if (sandboxes.size <= 1) return; // siempre queda al menos uno
  // El motor destruye los rigs, trails y timers de este sandbox
  iframe.contentWindow.postMessage({ type: "removeSandbox", sandboxId: sb.id }, "*");
  pendingRuns.delete(sb.id);
  sandboxes.delete(sb.id);
  ls.remove(codeKey(sb.id));
  sb.destroy();
  if (activeSandbox === sb) {
    activeSandbox = null;
    const last = [...sandboxes.values()].pop();
    if (last) last.activate();
  }
  refreshOnlyOne();
  writeLayout();
}

addSandboxBtn.addEventListener("click", () => {
  const sb = createSandbox();
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
  sb.paused = false; sb._renderPause();

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

  // clear() limpia SOLO este sandbox; grid/cámara/fondo ya son globales y no se reinician
  const configuracionOculta = `
    clear();
    pause(false);
  `;

  const codigoFinal = configuracionOculta + "\n" + transpiled;
  console.log(`Código final a ejecutar (sandbox ${sb.id}):\n`, codigoFinal);
  // order = posición del sandbox en la UI; el motor lo usa para el desplazamiento X por defecto
  const order = [...sandboxes.keys()].indexOf(sb.id);
  iframe.contentWindow.postMessage({ type: "execute", sandboxId: sb.id, order, code: codigoFinal }, "*");
}

// Ejecuta todos los sandboxes en el orden de la UI
function runAll() {
  if (errorToast) errorToast.classList.remove("visible");
  for (const sb of sandboxes.values()) {
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
    if (d.key === "s" && activeSandbox) activeSandbox.saveBtn.click();
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
    // Solo un rig seleccionado en toda la escena
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
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (activeSandbox) activeSandbox.saveBtn.click(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") { e.preventDefault(); if (globalPauseBtn) globalPauseBtn.click(); }
  if (e.key === "Escape") { e.preventDefault(); if (activeSandbox) activeSandbox.toggleBtn.click(); }
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

  // 1. Restaurar sandboxes guardados (lista de ids + geometría; el código está en movescript_sandbox_<id>)
  let restored = 0;
  const layout = readLayout();
  if (layout) {
    for (const it of layout.items) {
      if (restored >= MAX_SANDBOXES) break;
      if (!it || typeof it.id !== "string" || sandboxes.has(it.id)) continue;
      const stored = ls.get(codeKey(it.id));
      if (stored === null) continue; // entrada huérfana: sin código guardado
      const sb = createSandbox({ id: it.id, label: it.label, code: stored, layout: it, hasStored: true, activate: false });
      if (sb) { sb.markSaved(); pendingRuns.add(sb.id); restored++; }
    }
  }

  // 2. Migración del key antiguo al primer sandbox ("default")
  const legacy = ls.get(LEGACY_KEY);
  if (restored === 0) {
    const first = createSandbox({ id: "default", label: 1, code: legacy || "", hasStored: legacy !== null });
    if (legacy !== null) {
      ls.set(codeKey(first.id), legacy);
      first.markSaved();
      writeLayout();
      ls.remove(LEGACY_KEY);
    }
    pendingRuns.add(first.id);
  } else {
    [...sandboxes.values()][0].activate();
  }
}
init();