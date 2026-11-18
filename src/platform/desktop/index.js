export const capabilities = {
  localBvh: true,
  vr: false,
  tunnel: false,
  osc: false,
  autoUpdate: true
};

export const bvh = {
  async list() {
    if (typeof window !== 'undefined' && window.movescriptDesktop?.bvh?.list) {
      return window.movescriptDesktop.bvh.list();
    }
    throw new Error('window.movescriptDesktop API no disponible');
  },

  async resolveUrl(name) {
    if (typeof window !== 'undefined' && window.movescriptDesktop?.bvh?.resolveUrl) {
      return window.movescriptDesktop.bvh.resolveUrl(name);
    }
    throw new Error('window.movescriptDesktop API no disponible');
  },

  async importLocal(file) {
    if (typeof window !== 'undefined' && window.movescriptDesktop?.bvh?.importLocal) {
      return window.movescriptDesktop.bvh.importLocal(file);
    }
    throw new Error('window.movescriptDesktop API no disponible');
  }
};
