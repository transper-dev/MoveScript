/**
 * Validación unificada de nombres de animaciones BVH
 */

export function isValidBvhName(name) {
  if (typeof name !== 'string') return false;
  if (/^https?:\/\//i.test(name)) return false;
  if (name.includes('..') || name.includes('\\') || name.includes('%')) return false;
  const regex = /^[\w\- ]{1,64}(\/[\w\- ]{1,64})?$/;
  return regex.test(name);
}
