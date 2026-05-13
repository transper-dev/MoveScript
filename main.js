import { examples } from './examples.js';

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

const iframe = document.getElementById("preview");
const runBtn = document.getElementById("run");
const toggleBtn = document.getElementById("toggle");
const overlay = document.getElementById("overlay");
const bar = document.getElementById("bar");
const resizeHandle = document.getElementById("resizeHandle");
const randomBtn = document.getElementById("randomBtn");
const saveBtn = document.getElementById('saveBtn');
const globalPauseBtn = document.getElementById("globalPauseBtn");

// Elementos del sistema de errores visuales (Toast)
const errorToast = document.getElementById("error-toast");
const errorText = document.getElementById("error-text");
let errorTimeout;

let engineReady = false, pendingCode = null, isRigSelected = false, isGlobalPaused = false, isSaved = false;
let activeChainMarks = {};
let currentChainSteps = {};
let colorWidgets = [];
let colorUpdateTimer = null;

const isNewBlock = (lines, idx) => {
  if (!lines[idx].trim().startsWith('[')) return false;
  let prev = idx - 1;
  while (prev >= 0 && lines[prev].trim() === "") prev--;
  if (prev >= 0 && lines[prev].trim().endsWith('>')) return false; // Es una continuación, no cortamos
  return true;
};

function highlightStep(codeIndex, step) {
  if (!window.editor) return;
  let lines = window.editor.getValue().split('\n');
  let currentIdx = 0, blockStartLine = -1;

  // 1. Buscamos en qué línea empieza el bloque principal
  for (let i = 0; i < lines.length; i++) {
    if (isNewBlock(lines, i)) {
      if (currentIdx === codeIndex) { blockStartLine = i; break; }
      currentIdx++;
    }
  }

  // 2. Buscamos el paso exacto para iluminarlo
  if (blockStartLine !== -1) {
    let currentStep = 0;
    let startPos = null, endPos = null;
    let l = blockStartLine;
    let c = lines[l].indexOf('[');

    while (l < lines.length) {
      let lineStr = lines[l];

      while (c < lineStr.length) {
        let char = lineStr[c];

        if (char === '[') {
          // Si estamos en el paso correcto, marcamos el inicio
          if (currentStep === step) { startPos = { line: l, ch: c }; }
        } else if (char === ']') {
          // Si estamos en el paso correcto, marcamos el final justo después del corchete
          if (currentStep === step) { endPos = { line: l, ch: c + 1 }; break; }
        } else if (char === '>') {
          // Al ver un salto de cadena, avanzamos el contador de pasos
          if (currentStep < step) currentStep++;
        }

        c++;
      }

      if (endPos) break;

      l++;
      c = 0;

      // Si llegamos a un bloque nuevo distinto, cortamos la búsqueda
      if (l < lines.length && isNewBlock(lines, l)) {
        break;
      }
    }

    // 3. Aplicamos la luz si encontramos las coordenadas
    if (startPos && endPos) {
      if (activeChainMarks[codeIndex]) {
        activeChainMarks[codeIndex].clear();
      }
      activeChainMarks[codeIndex] = window.editor.markText(
        startPos, endPos, { className: "chain-active-text" }
      );
    }
  }
}

function updateColorWidgets() {
  if (!window.editor) return;

  colorWidgets.forEach(widget => widget.clear());
  colorWidgets = [];

  const colorRegex = /(["'])(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})|red|blue|green|yellow|cyan|magenta|white|black|pink|orange|purple|gray)\1/gi;
  const lineCount = window.editor.lineCount();

  for (let i = 0; i < lineCount; i++) {
    const lineText = window.editor.getLine(i);
    let match;

    while ((match = colorRegex.exec(lineText)) !== null) {
      const colorStr = match[2];
      const pos = { line: i, ch: match.index };

      const colorBox = document.createElement("span");
      colorBox.className = "color-widget";
      colorBox.style.backgroundColor = colorStr;

      const widget = window.editor.setBookmark(pos, { widget: colorBox });
      colorWidgets.push(widget);
    }
  }
}

const codeEl = document.getElementById("code");
window.editor = CodeMirror.fromTextArea(codeEl, {
  mode: "javascript",
  theme: "monokai",
  lineNumbers: false,
  lineWrapping: true,
  matchBrackets: true,
});

window.editor.on("keydown", (cm, e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    e.stopPropagation();
    if (saveBtn) saveBtn.click();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
    e.preventDefault();
    e.stopPropagation();
    if (globalPauseBtn) globalPauseBtn.click();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    run();
  }

  if (isRigSelected && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
    e.stopPropagation();
    iframe.contentWindow.postMessage({ type: 'remoteKey', key: e.key, shiftKey: e.shiftKey }, '*');
  }
});

function updateEditor(codeIndex, modifierCallback) {
  let code = window.editor.getValue();
  let lines = code.split('\n');
  let currentIdx = 0, charCount = 0;

  for (let i = 0; i < lines.length; i++) {
    if (isNewBlock(lines, i)) {
      if (currentIdx === codeIndex) {
        let start = charCount, j = i, end = charCount + lines[i].length;
        while (j < lines.length && !lines[j].includes(';')) {
          j++;
          if (j < lines.length) {
            if (isNewBlock(lines, j)) break;
            end += 1 + lines[j].length;
          }
        }

        let statement = code.substring(start, end);
        let bIdx = statement.indexOf(']');

        if (modifierCallback && bIdx !== -1) {
          statement = modifierCallback(statement, bIdx);
          const startPos = window.editor.posFromIndex(start);
          const endPos = window.editor.posFromIndex(end);
          window.editor.replaceRange(statement, startPos, endPos);

          if (currentChainSteps[codeIndex] !== undefined) {
            highlightStep(codeIndex, currentChainSteps[codeIndex]);
          }

        } else {
          const startPos = window.editor.posFromIndex(start);
          const endPos = window.editor.posFromIndex(end);
          window.editor.setSelection(startPos, endPos);
        }
        return;
      }
      currentIdx++;
    }
    charCount += lines[i].length + 1;
  }
}

window.addEventListener('message', (e) => {
  if (e.data.type === 'ready') {
    engineReady = true;
    if (pendingCode !== null) { runCode(pendingCode); pendingCode = null; }
  } else if (e.data.type === 'error') {
    // --- MANEJO DEL TOAST DE ERROR ---
    if (errorToast && errorText) {
      let mensajeLimpio = e.data.message.split('\n')[0];
      errorText.textContent = mensajeLimpio;
      errorToast.classList.add('visible');

      clearTimeout(errorTimeout);
      errorTimeout = setTimeout(() => {
        errorToast.classList.remove('visible');
      }, 6000);
    } else {
      console.error(e.data.message);
    }
  } else if (e.data.type === 'rigMoved') {
    updateEditor(e.data.codeIndex, (st, bIdx) => {
      let inside = st.substring(0, bIdx).replace(/\.pos\([^)]+\)/g, '').replace(/\.x\([^)]+\)/g, '').replace(/\.z\([^)]+\)/g, '');
      return inside + `.pos(${Math.round(e.data.x)}, 0, ${Math.round(e.data.z)})` + st.substring(bIdx);
    });
  } else if (e.data.type === 'rigRotated') {
    updateEditor(e.data.codeIndex, (st, bIdx) => {
      let inside = st.substring(0, bIdx).replace(/\.rotX\([^)]+\)/g, '').replace(/\.rotY\([^)]+\)/g, '');
      let rStr = '';
      if (Math.abs(e.data.rotX) > 0.01) rStr += `.rotX(${e.data.rotX.toFixed(2)})`;
      if (Math.abs(e.data.rotY) > 0.01) rStr += `.rotY(${e.data.rotY.toFixed(2)})`;
      return inside + rStr + st.substring(bIdx);
    });
  } else if (e.data.type === 'rigSelected') {
    isRigSelected = true;
    updateEditor(e.data.codeIndex, null);
  } else if (e.data.type === 'rigDeselected') {
    isRigSelected = false;
    const cursor = window.editor.getCursor();
    window.editor.setSelection(cursor, cursor);
  } else if (e.data.type === 'chainStep') {
    currentChainSteps[e.data.codeIndex] = e.data.step;
    highlightStep(e.data.codeIndex, e.data.step);
  } else if (e.data.type === 'globalHotkey') {
    if (e.data.key === "enter") run();
    if (e.data.key === "s" && saveBtn) saveBtn.click();
    if (e.data.key === "p" && globalPauseBtn) globalPauseBtn.click();
  }
});

function run() {
  // Limpiamos el error visual si lo hubiera
  if (errorToast) errorToast.classList.remove('visible');

  const code = window.editor.getValue();
  if (!engineReady) { pendingCode = code; } else { runCode(code); }

  const cursor = window.editor.getCursor();
  let startLine = cursor.line;
  let endLine = cursor.line;

  while (startLine > 0 && window.editor.getLine(startLine - 1).trim() !== "") {
    startLine--;
  }

  const lastLine = window.editor.lineCount() - 1;
  while (endLine < lastLine && window.editor.getLine(endLine + 1).trim() !== "") {
    endLine++;
  }

  for (let i = startLine; i <= endLine; i++) {
    window.editor.addLineClass(i, "background", "flash-line");
  }

  setTimeout(() => {
    for (let i = startLine; i <= endLine; i++) {
      window.editor.removeLineClass(i, "background", "flash-line");
    }
  }, 400);
}

function runCode(code) {
  Object.values(activeChainMarks).forEach(marker => {
    if (marker && marker.clear) marker.clear();
  });
  activeChainMarks = {};

  isGlobalPaused = false;
  if (globalPauseBtn) globalPauseBtn.textContent = 'Pause (Ctrl+P)';

  let transpiled = code.replace(/(?:\[[\s\S]*?\](?:\s*>\s*\[[\s\S]*?\])*)/g, (match) => {
    let parts = match.split('>');
    let cleanedParts = parts.map(p => {
      let inside = p.trim().replace(/^\[/, '').replace(/\]$/, '').trim();
      return inside === '' ? `$B()` : `$B().${inside}`;
    });
    return `CHAIN(${cleanedParts.join(', ')})`;
  });

  const configuracionOculta = `
    clear();
    grid(800, 20);
    cam(0, 150, 350, 0, 100, 0);
    bg("#0a0a0a");
  `;

  const codigoFinal = configuracionOculta + "\n" + transpiled;
  iframe.contentWindow.postMessage({ type: 'execute', code: codigoFinal }, '*');
}

runBtn.addEventListener("click", run);

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (saveBtn) saveBtn.click(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") { e.preventDefault(); if (globalPauseBtn) globalPauseBtn.click(); }
  if (e.key === "Escape") { e.preventDefault(); if (toggleBtn) toggleBtn.click(); }
});

if (globalPauseBtn) {
  globalPauseBtn.addEventListener('click', () => {
    isGlobalPaused = !isGlobalPaused;
    globalPauseBtn.textContent = isGlobalPaused ? 'Play (Ctrl+P)' : 'Pause (Ctrl+P)';
    iframe.contentWindow.postMessage({ type: 'execute', code: `pause(${isGlobalPaused});` }, '*');
  });
}

const loader = document.getElementById("loader");
let currentExampleIndex = 0, debounceTimer = null;

if (randomBtn) {
  randomBtn.addEventListener("click", () => {
    let randomIndex;
    do { randomIndex = Math.floor(Math.random() * examples.length); } while (randomIndex === currentExampleIndex || randomIndex === 0);
    currentExampleIndex = randomIndex;

    window.editor.setValue(`///// ${examples[currentExampleIndex].name} /////\n${examples[currentExampleIndex].code}`);

    if (loader) loader.style.display = "block";
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { run(); if (loader) loader.style.display = "none"; }, 3000);
  });
}

let prevSize = null;
toggleBtn.addEventListener("click", () => {
  if (overlay.classList.toggle("minimized")) {
    prevSize = { width: overlay.style.width || "", height: overlay.style.height || "" };
    overlay.style.height = bar.offsetHeight + "px"; toggleBtn.textContent = " Show (Esc)";
  } else {
    overlay.style.width = prevSize?.width || ""; overlay.style.height = prevSize?.height || "";
    toggleBtn.textContent = " Hide (Esc)";
  }
});

let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
bar.addEventListener("pointerdown", (e) => {
  if (e.target && e.target.tagName === "BUTTON") return;
  dragging = true; bar.setPointerCapture(e.pointerId);
  const rect = overlay.getBoundingClientRect();
  startX = e.clientX; startY = e.clientY; startLeft = rect.left; startTop = rect.top;
});
window.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  overlay.style.left = `${Math.max(8, Math.min(window.innerWidth - overlay.offsetWidth - 8, startLeft + (e.clientX - startX)))}px`;
  overlay.style.top = `${Math.max(8, Math.min(window.innerHeight - overlay.offsetHeight - 8, startTop + (e.clientY - startY)))}px`;
});
window.addEventListener("pointerup", () => { dragging = false; });

let resizing = false, startW = 0, startH = 0, startRX = 0, startRY = 0;
resizeHandle.addEventListener("pointerdown", (e) => {
  resizing = true; resizeHandle.setPointerCapture(e.pointerId);
  startW = overlay.offsetWidth; startH = overlay.offsetHeight;
  startRX = e.clientX; startRY = e.clientY; e.preventDefault();
});
window.addEventListener("pointermove", (e) => {
  if (!resizing) return;
  overlay.style.width = `${Math.max(420, Math.min(window.innerWidth - 16, startW + (e.clientX - startRX)))}px`;
  overlay.style.height = `${Math.max(220, Math.min(window.innerHeight - 16, startH + (e.clientY - startRY)))}px`;
});
window.addEventListener("pointerup", () => { resizing = false; });

saveBtn.addEventListener('click', () => {
  if (isSaved) {
    localStorage.removeItem('movescript_saved_code');
    isSaved = false; saveBtn.textContent = ' Save (Ctrl+S)'; saveBtn.classList.remove('saved');
  } else {
    localStorage.setItem('movescript_saved_code', window.editor.getValue());
    isSaved = true; saveBtn.textContent = 'Saved'; saveBtn.classList.add('saved');
  }
});

window.editor.on('change', () => {
  if (isSaved) {
    isSaved = false; saveBtn.textContent = ' Save (Ctrl+S) *'; saveBtn.classList.remove('saved');
  } else if (saveBtn.textContent === ' Save (Ctrl+S)') {
    saveBtn.textContent = ' Save (Ctrl+S) *';
  }
  clearTimeout(colorUpdateTimer);
  colorUpdateTimer = setTimeout(updateColorWidgets, 200);
});

function init() {
  iframe.srcdoc = buildPreviewHtml();
  const savedCode = localStorage.getItem('movescript_saved_code');
  if (savedCode) {
    window.editor.setValue(savedCode);
    isSaved = true; saveBtn.textContent = 'Saved'; saveBtn.classList.add('saved');
  } else {
    window.editor.setValue(examples[0].code);//"" para sandbox vacio, examples[0].code para cargar el ejemplo por defecto
    isSaved = false; saveBtn.textContent = ' Save (Ctrl+S)'; saveBtn.classList.remove('saved');
  }
  pendingCode = window.editor.getValue();
  updateColorWidgets();
}
init();