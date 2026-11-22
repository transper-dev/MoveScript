import { isValidBvhName } from '../../shared/bvhName.js';

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
      if (typeof name === 'string' && /^https?:\/\//i.test(name)) {
        throw new Error('no permitido en la versión web');
      }
      if (!isValidBvhName(name)) {
        throw new Error(`Nombre de animación inválido: ${name}`);
      }
      return `./assets/bvh/${name}.bvh`;
    }
  }
};

