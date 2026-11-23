import { capabilities as webCaps } from './web.js';
import { capabilities as desktopCaps } from './desktop.js';

// En el renderer de Electron, process.versions.electron está presente
// incluso si nodeIntegration: false, siempre que se use contextBridge o preload.
const isDesktop = (typeof process !== 'undefined' && process.versions && !!process.versions.electron) ||
                  (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes(' electron/'));

export const capabilities = isDesktop ? desktopCaps : webCaps;

export function getPlatformInfo() {
  return {
    name: isDesktop ? 'desktop' : 'web',
    version: '1.0.0',
    capabilities
  };
}
