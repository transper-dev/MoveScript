import { isNewBlock } from '../dsl/transpile.js';
import { MessageTypes, getTargetOrigin } from '../shared/protocol.js';
import { ls, codeKey } from './storage.js';
import { startTabGesture } from './sandboxWindow.js';
import { emit } from './events.js';
import {
  activeSandbox,
  setActiveSandbox,
  incrementZCounter,
  runSandbox,
  runAll,
  writeLayout
} from '../main.js';

// Compatibilidad: sidebar de ayuda y cajón de BVH usan window.editor => CodeMirror del sandbox ACTIVO
// Para mantener el comportamiento exacto, window.editor se define/actualiza en main.js o mediante la propiedad activa.

export class Sandbox {
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
    setActiveSandbox(this);
    if (w) {
      w.el.classList.add("active");
      w.el.style.zIndex = incrementZCounter();
      if (w.activeSb !== this) w.selectTab(this);
    }
  }

  // ---------- CodeMirror ----------
  _wireCodeMirror() {
    this.cm.on("focus", () => this.activate());

    this.cm.on("keydown", (cm, e) => {
      const globalPauseBtn = document.getElementById("globalPauseBtn");
      const iframe = document.getElementById("preview");

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault(); e.stopPropagation(); this.toggleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault(); e.stopPropagation(); if (globalPauseBtn) globalPauseBtn.click();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault(); e.stopPropagation();
        if (e.shiftKey) runAll(); else runSandbox(this);
      }
      if (this.isRigSelected && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault(); e.stopPropagation();
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: MessageTypes.REMOTE_KEY, sandboxId: this.id, key: e.key, shiftKey: e.shiftKey }, getTargetOrigin());
        }
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
    this.tabEl.addEventListener("auxclick", (e) => { if (e.button === 1) emit("REMOVE_SANDBOX", this); });
    this.tabEl.querySelector(".sb-tab-close").addEventListener("click", (e) => {
      e.stopPropagation();
      emit("REMOVE_SANDBOX", this);
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
    const iframe = document.getElementById("preview");
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: MessageTypes.PAUSE_SANDBOX, sandboxId: this.id, paused: this.paused }, getTargetOrigin());
    }
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
