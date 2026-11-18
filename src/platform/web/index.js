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
      if (typeof name !== 'string' || !/^[\w\- ]{1,64}$/.test(name)) {
        throw new Error(`Nombre de animación inválido: ${name}`);
      }
      return `./assets/bvh/${name}.bvh`;
    }
  }
};
