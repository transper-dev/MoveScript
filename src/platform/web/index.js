export const platform = {
  capabilities: {
    localBvh: false,
    vr: false,
    tunnel: false,
    osc: false,
    autoUpdate: false
  },
  bvh: {
    async list() {
      const res = await fetch('./assets/lista.json');
      if (!res.ok) throw new Error('No se pudo cargar la lista de animaciones');
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.animations || []);
      if (!Array.isArray(list)) throw new Error('Formato de lista inválido');
      return list.map(name => ({ name, source: 'global' }));
    },
    async resolveUrl(name) {
      if (typeof name !== 'string') {
        throw new Error(`Nombre de animación inválido: ${name}`);
      }
      if (/^https?:\/\//i.test(name)) {
        throw new Error('no permitido en la versión web');
      }
      if (name.includes('..') || name.includes('\\') || name.includes('%')) {
        throw new Error(`Nombre de animación inválido: ${name}`);
      }
      const regex = /^[\w\- ]{1,64}(\/[\w\- ]{1,64})?$/;
      if (!regex.test(name)) {
        throw new Error(`Nombre de animación inválido: ${name}`);
      }
      return `./assets/bvh/${name}.bvh`;
    }
  }
};
