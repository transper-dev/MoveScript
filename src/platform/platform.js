/* global __MS_PROFILE__ */

let currentPlatform = null;

export async function getPlatform() {
  if (currentPlatform) return currentPlatform;
  const profile = (typeof __MS_PROFILE__ !== 'undefined') ? __MS_PROFILE__ : 'web';
  if (profile === 'desktop') {
    const mod = await import('./desktop/index.js');
    currentPlatform = { capabilities: mod.capabilities, bvh: mod.bvh };
  } else {
    const mod = await import('./web/index.js');
    currentPlatform = mod.platform;
  }
  return currentPlatform;
}
