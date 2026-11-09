/**
 * Transpile - Tokenizador y parser del DSL de MoveScript
 * Convierte el código DSL [bvh("name")]>.method()>.method() en bloques ejecutables
 */

function isValidDslStart(code, index) {
  let inStr = false;
  let strCh = null;
  let inLineComm = false;
  let inMultiComm = false;
  let tokens = [];
  let currentWord = '';

  for (let c = 0; c < index; c++) {
    const ch = code[c];
    const nxt = code[c + 1];

    if (!inStr && !inMultiComm) {
      if (!inLineComm && ch === '/' && nxt === '/') { inLineComm = true; c++; continue; }
      if (!inLineComm && ch === '/' && nxt === '*') { inMultiComm = true; c++; continue; }
    }
    if (inLineComm && ch === '\n') { inLineComm = false; continue; }
    if (inMultiComm && ch === '*' && nxt === '/') { inMultiComm = false; c++; continue; }
    if (inLineComm || inMultiComm) continue;

    if (ch === '"' || ch === "'" || ch === '`') {
      if (!inStr) { inStr = true; strCh = ch; }
      else if (inStr && ch === strCh && code[c-1] !== '\\') { inStr = false; }
      continue;
    }
    if (inStr) continue;

    if (/\s/.test(ch)) {
      if (currentWord) {
        tokens.push(currentWord);
        currentWord = '';
      }
      if (ch === '\n') tokens.push('\n');
    } else if (/[\w$]/.test(ch)) {
      currentWord += ch;
    } else {
      if (currentWord) {
        tokens.push(currentWord);
        currentWord = '';
      }
      tokens.push(ch);
    }
  }
  if (currentWord) tokens.push(currentWord);

  const sigTokens = tokens.filter(t => t !== ' ' && t !== '\t' && t !== '\r');
  if (sigTokens.length === 0) return true;

  const last = sigTokens[sigTokens.length - 1];
  let effectiveLast = last;
  if (last === '\n' && sigTokens.length > 1) {
    effectiveLast = sigTokens[sigTokens.length - 2];
  }

  if (['=', ':', ',', '(', '['].includes(effectiveLast)) return false;
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(effectiveLast)) return false;
  if (effectiveLast === ')' || effectiveLast === ']') return false;

  return true;
}

/**
 * Tokenizador robusto que respeta comentarios, strings y paréntesis balanceados
 * Parsea bloques de la forma: [bvh("name")]>.method()>.method()
 *
 * @param {string} code - Código DSL completo
 * @returns {Array<{start: number, end: number, startLine: number, parts: string[]}>} - Array de bloques parseados
 */
export function parseBlocks(code) {
  const blocks = [];
  let i = 0;
  let inString = false;
  let stringChar = null;
  let inComment = false;
  let inMultiComment = false;

  while (i < code.length) {
    const char = code[i];
    const nextChar = code[i + 1];

    if (!inString && !inMultiComment) {
      if (!inComment && char === '/' && nextChar === '/') {
        inComment = true;
        i += 2;
        continue;
      }
    }
    if (inComment && char === '\n') {
      inComment = false;
      i++;
      continue;
    }
    if (!inString && !inComment) {
      if (!inMultiComment && char === '/' && nextChar === '*') {
        inMultiComment = true;
        i += 2;
        continue;
      }
    }
    if (inMultiComment && char === '*' && nextChar === '/') {
      inMultiComment = false;
      i += 2;
      continue;
    }
    if (inComment || inMultiComment) {
      i++;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar && code[i - 1] !== '\\') {
        inString = false;
        stringChar = null;
      }
      i++;
      continue;
    }

    if (!inString) {
      if (char === '[') {
        if (isValidDslStart(code, i)) {
          const blockStart = i;
          const parts = [];
          let currentPart = '[';
          let depth = 1;
          i++;

          while (i < code.length && depth > 0) {
            const c = code[i];
            if (c === '"' || c === "'" || c === '`') {
              const sc = c;
              currentPart += c;
              i++;
              while (i < code.length) {
                currentPart += code[i];
                if (code[i] === sc && code[i - 1] !== '\\') {
                  i++;
                  break;
                }
                i++;
              }
              continue;
            }

            if (c === '[') depth++;
            else if (c === ']') {
              depth--;
              currentPart += c;
              i++;
              if (depth === 0) {
                parts.push(currentPart.trim());
                currentPart = '';

                // Check for syntax error '].' right after ']'
                let j = i;
                let nextNonWs = '';
                while (j < code.length) {
                  if (code[j] === ' ' || code[j] === '\t' || code[j] === '\n' || code[j] === '\r') {
                    j++;
                    continue;
                  }
                  if (code[j] === '/' && code[j+1] === '/') {
                    while (j < code.length && code[j] !== '\n') j++;
                    continue;
                  }
                  if (code[j] === '/' && code[j+1] === '*') {
                    j += 2;
                    while (j < code.length && !(code[j] === '*' && code[j+1] === '/')) j++;
                    if (j < code.length) j += 2;
                    continue;
                  }
                  nextNonWs = code[j];
                  break;
                }

                if (nextNonWs === '.') {
                  throw new Error(`Error de sintaxis: No uses punto '.' después del bloque. Usa el pipe '>'`);
                }

                let k = i;
                while (k < code.length && (code[k] === ' ' || code[k] === '\t' || code[k] === '\n' || code[k] === '\r')) k++;
                if (code[k] === '>') {
                  i = k + 1;
                  while (i < code.length && (code[i] === ' ' || code[i] === '\t' || code[i] === '\n' || code[i] === '\r')) i++;
                  if (code[i] === '[') {
                    depth = 1;
                    currentPart = '[';
                    i++;
                  }
                }
              }
              continue;
            }
            currentPart += c;
            i++;
          }

          const blockEnd = i;
          const startLine = code.substring(0, blockStart).split('\n').length;
          blocks.push({
            start: blockStart,
            end: blockEnd,
            startLine,
            parts
          });
          continue;
        }
      }
    }
    i++;
  }

  return blocks;
}

/**
 * Detecta si una línea es el inicio de un nuevo bloque
 * (no está precedida por una línea que termine con >)
 *
 * @param {string[]} lines - Líneas del código
 * @param {number} idx - Índice de la línea a verificar
 * @returns {boolean} - true si es un nuevo bloque
 */
export function isNewBlock(lines, idx) {
  if (!lines[idx].trim().startsWith("[")) return false;
  let prev = idx - 1;
  while (prev >= 0 && lines[prev].trim() === "") prev--;
  if (prev >= 0 && lines[prev].trim().endsWith(">")) return false;
  return true;
}

/**
 * Transpila un bloque parseado a código JavaScript ejecutable
 * Convierte [bvh("name")]>.method()>.method() en CHAIN(bvh("name")).method().method()
 *
 * @param {Object} block - Bloque parseado con {start, end, startLine, parts}
 * @returns {string} - Código JavaScript ejecutable
 */
export function transpileBlock(block) {
  if (!block || !block.parts || block.parts.length === 0) return "";

  if (block.parts.length === 1) {
    const inside = block.parts[0].replace(/^\[/, '').replace(/\]$/, '');
    return `CHAIN($B().${inside})`;
  }

  const chainArguments = block.parts.map(part => {
    const inside = part.replace(/^\[/, '').replace(/\]$/, '');
    return `$B().${inside}`;
  }).join(', ');

  return `CHAIN(${chainArguments})`;
}
