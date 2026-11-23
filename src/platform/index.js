import { capabilities as webCaps } from './web.js';
import { capabilities as desktopCaps } from './desktop.js';

const isDesktop = typeof process !== 'undefined' && process.versions && !!process.versions.electron;

export const capabilities = isDesktop ? desktopCaps : webCaps;

export function getPlatformInfo() {
  return {
    name: isDesktop ? 'desktop' : 'web',
    version: '1.0.0',
    capabilities
  };
}
