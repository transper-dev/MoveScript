/**
 * Platform Capabilities Interface & Web Implementation
 */

export const capabilities = {
  isWeb: true,
  isDesktop: false,
  hasLocalBvh: false,
  hasVrTunnel: false,
  hasOsc: false,
  hasSocketIO: false
};

export function getPlatformInfo() {
  return {
    name: 'web',
    version: '1.0.0',
    capabilities
  };
}
