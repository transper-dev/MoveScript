/**
 * AnimationList - Carga y renderizado de la lista de animaciones BVH usando platform.bvh.list()
 * Inserta la animación seleccionada en el editor activo
 */

import { getPlatform } from '../platform/platform.js';

export async function initAnimationList() {
  const bvhList = document.getElementById('bvh-list');
  const iframePreview = document.getElementById('preview');

  if (!bvhList) {
    console.warn('BVH list element not found');
    return;
  }

  let animacionesDisponibles = [];

  try {
    const platform = await getPlatform();
    const items = await platform.bvh.list();
    if (Array.isArray(items)) {
      animacionesDisponibles = items.map(item => (typeof item === 'string' ? item : item.name));
    }
  } catch (e) {
    console.warn("No se pudo cargar la lista de platform.bvh", e);
  }

  // Fallback si nada funciona
  if (animacionesDisponibles.length === 0) {
    const msg = "Cargando animaciones de emergencia.";
    console.error(msg);
    // TODO: Registrar en informe de cobertura/log persistente
    animacionesDisponibles = ["turn", "silly_walk", "monster_walk", "serious_walk"];
  }

  // Renderizar los botones en el drawer
  animacionesDisponibles = animacionesDisponibles.filter(nombre => nombre !== 'dummy');
  animacionesDisponibles.forEach(nombre => {
    const btn = document.createElement('div');
    btn.className = 'bvh-item';
    const span = document.createElement('span');
    span.textContent = nombre;
    btn.appendChild(span);

    btn.addEventListener('click', () => {
      if (!window.editor) return;
      let code = window.editor.getValue();

      const regexBusqueda = /\[[^\]]+\]/;

      if (regexBusqueda.test(code)) {
        code = code.replace(regexBusqueda, `[bvh("${nombre}")]\n>$&`);
      } else {
        const salto = code.trim() !== "" ? "\n\n" : "";
        code += `${salto}[bvh("${nombre}")]`;
      }

      window.editor.setValue(code);
      if (iframePreview.contentWindow && window.runActiveSandbox) window.runActiveSandbox();
    });

    bvhList.appendChild(btn);
  });
}
