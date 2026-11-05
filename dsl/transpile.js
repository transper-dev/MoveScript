/**
 * Transpile - Tokenizador y parser del DSL de MoveScript
 * Convierte el código DSL [bvh("name")]>.method()>.method() en bloques ejecutables
 */

/**
 * Tokenizador robusto que respeta comentarios, strings y paréntesis balanceados
 * Parsea bloques de la forma: [bvh("name")]>.method()>.method()
 *
 * @param {string} code - Código DSL completo
 * @returns {Array<{startLine: number, parts: string[]}>} - Array de bloques parseados
 */
export function parseBlocks(code) {
  const blocks = [];
  const lines = code.split("\n");
  let i = 0;
  let currentBlock = { startLine: -1, parts: [] };
  let inBlock = false;
  let inString = false;
  let stringChar = null;
  let inComment = false;
  let depth = 0;
  let currentPart = "";

  while (i < code.length) {
    const char = code[i];
    const nextChar = code[i + 1];

    // Saltar líneas de comentario
    if (!inString && char === "/" && nextChar === "/") {
      inComment = true;
      i++;
      continue;
    }
    if (char === "\n") {
      inComment = false;
    }
    if (inComment) {
      i++;
      continue;
    }

    // Strings
    if (!inComment && (char === '"' || char === "'")) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar && code[i - 1] !== "\\") {
        inString = false;
        stringChar = null;
      }
    }

    if (!inString && !inComment) {
      if (char === "[") {
        if (!inBlock) {
          inBlock = true;
          currentBlock = { startLine: lines.slice(0, i).join("\n").split("\n").length - 1, parts: [] };
          currentPart = "[";
        } else {
          currentPart += char;
        }
        depth++;
        i++;
        continue;
      } else if (char === "]") {
        currentPart += char;
        depth--;
        if (depth === 0) {
          // Fin de una parte [...]
          currentBlock.parts.push(currentPart.trim());
          currentPart = "";
          // Buscar si hay un > después (puede haber espacios/newlines)
          let j = i + 1;
          while (j < code.length && (code[j] === " " || code[j] === "\t" || code[j] === "\n")) j++;
          if (code[j] === ">") {
            // Continuación: consumir el > y seguir esperando el siguiente [
            i = j;
          } else {
            // Fin del bloque
            if (currentBlock.parts.length > 0) {
              blocks.push(currentBlock);
            }
            inBlock = false;
            currentBlock = { startLine: -1, parts: [] };
          }
        }
        i++;
        continue;
      }
    }

    if (inBlock) {
      currentPart += char;
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
 * @param {Object} block - Bloque parseado con {startLine, parts}
 * @returns {string} - Código JavaScript ejecutable
 */
export function transpileBlock(block) {
  if (!block || !block.parts || block.parts.length === 0) return "";

  // Si solo hay una parte, no necesita CHAIN
  if (block.parts.length === 1) {
    return block.parts[0];
  }

  // Múltiples partes: CHAIN(part1).part2.part3...
  const [first, ...rest] = block.parts;
  const chainedMethods = rest.map(part => {
    // Remover el [ inicial y ] final de cada parte
    return part.replace(/^\[/, '').replace(/\]$/, '');
  }).join('.');

  return `CHAIN(${first}).${chainedMethods}`;
}
