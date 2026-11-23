/**
 * Validador seguro para nombres de archivo BVH en MoveScript_BVH.
 * Previene Path Traversal y asegura nombres de archivo válidos.
 */
export function sanitizeBvhFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    throw new Error('Invalid file name: name must be a non-empty string.');
  }

  // Prevenir path traversal explícito
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    throw new Error('SecurityError: Path traversal or directory separators are not allowed.');
  }

  // Quitar extensión si viene con ella y reasignar
  const cleanBase = fileName.replace(/\.bvh$/i, '').trim();

  // Permitir solo caracteres alfanuméricos, guiones y guiones bajos
  if (!/^[a-zA-Z0-9_-]+$/.test(cleanBase)) {
    throw new Error('Invalid file name: only alphanumeric, dashes, and underscores allowed.');
  }

  return `${cleanBase}.bvh`;
}
