import { parseBlocks, transpileBlock } from '../dsl/transpile.js';
import { MessageTypes, getTargetOrigin } from '../shared/protocol.js';
import * as state from '../core/state.js';

let iframe;

export function initRunner(iframeEl) {
  iframe = iframeEl;
}

export function runSandbox(sb, runCodeCallback) {
  const code = sb.cm.getValue();
  runCodeCallback(sb, code);

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

export function runCode(sb, code, showError, setGlobalPauseUI) {
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
  const sorted = [...state.sandboxes.values()].sort((a, b) => a.label - b.label);
  const order = sorted.indexOf(sb);
  iframe.contentWindow.postMessage({ type: MessageTypes.EXECUTE, sandboxId: sb.id, order, code: codigoFinal }, getTargetOrigin());
}
