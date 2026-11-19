/**
 * DSL Insert - Lógica de inserción de animaciones en la cadena existente
 */
import { parseBlocks } from './transpile.js';

/**
 * Inserta o anexa un bloque bvh a la cadena existente
 * @param {string} code - Código actual
 * @param {string} name - Nombre de la animación
 * @returns {{code?: string, cursorIndex?: number, error?: string}}
 */
export function appendBvhToChain(code, name) {
  // 1. Validación de nombre (reutilizando lógica similar a resolveUrl)
  const regex = /^[\w\- ]{1,64}(\/[\w\- ]{1,64})?$/;
  if (typeof name !== 'string' || /^https?:\/\//i.test(name) || name.includes('..') || name.includes('\\') || name.includes('%') || !regex.test(name)) {
    return { error: 'Nombre de animación inválido' };
  }

  // 2. Parseo
  let blocks;
  try {
    blocks = parseBlocks(code);
  } catch (e) {
    return { error: e.message };
  }

  // 3. Lógica según número de bloques
  if (blocks.length > 1) {
    return { error: 'Solo se permite una secuencia continua por sandbox. Une los bloques con \'>\'' };
  }

  if (blocks.length === 0) {
    // 0 bloques: Añadir al final
    const newCode = code.trim() === "" ? `[bvh("${name}")]` : `${code}\n[bvh("${name}")]`;
    return { code: newCode, cursorIndex: newCode.length };
  }

  // 1 bloque: Insertar tras el bloque
  const b = blocks[0];
  const newPart = `\n>[bvh("${name}")]`;
  const newCode = code.slice(0, b.end) + newPart + code.slice(b.end);
  return { code: newCode, cursorIndex: b.end + newPart.length };
}
