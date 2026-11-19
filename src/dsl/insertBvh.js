/**
 * DSL Insert - Lógica de inserción de animaciones en la cadena existente
 */

/**
 * Inserta o anexa un bloque bvh a la cadena existente
 * @param {string} currentCode - Código actual
 * @param {string} bvhName - Nombre de la animación
 * @returns {string} - Código actualizado
 */
export function appendBvhToChain(currentCode, bvhName) {
  const trimmed = currentCode.trim();
  if (trimmed === "") {
    return `[bvh("${bvhName}")]`;
  }

  // Si ya termina en un bloque, simplemente añadimos >
  if (trimmed.endsWith("]")) {
    return `${currentCode}\n>[bvh("${bvhName}")]`;
  }

  // Si no, añadimos un nuevo bloque
  return `${currentCode}\n\n[bvh("${bvhName}")]`;
}
