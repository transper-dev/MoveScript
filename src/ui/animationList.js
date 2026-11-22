/**
 * AnimationList - Carga y renderizado de la lista de animaciones BVH usando platform.bvh.list()
 * Inserta la animación seleccionada en el editor activo
 */

import { getPlatform } from '../platform/platform.js';
import { appendBvhToChain } from '../dsl/insertBvh.js';

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

    const hoverPreviewContainer = document.getElementById('hover-preview-container');
    const hoverPreviewImage = document.getElementById('hover-preview-image');

    btn.addEventListener('mouseenter', () => {
      span.textContent = `ADD ${nombre}`;
      if (hoverPreviewContainer && hoverPreviewImage) {
        hoverPreviewImage.src = `./assets/gifs/${encodeURIComponent(nombre)}.gif`;
        hoverPreviewContainer.classList.add('visible');
        hoverPreviewImage.onerror = () => {
           if (hoverPreviewContainer) hoverPreviewContainer.classList.remove('visible');
        };
      }
    });

    btn.addEventListener('mousemove', (e) => {
      if (hoverPreviewContainer) {
        const x = e.clientX + 15;
        const y = e.clientY - 265;
        hoverPreviewContainer.style.left = `${Math.min(x, window.innerWidth - 270)}px`;
        hoverPreviewContainer.style.top = `${Math.max(y, 10)}px`;
      }
    });

    btn.addEventListener('mouseleave', () => {
      span.textContent = nombre;
      if (hoverPreviewContainer) {
        hoverPreviewContainer.classList.remove('visible');
        if (hoverPreviewImage) hoverPreviewImage.src = '';
      }
    });

    btn.addEventListener('click', () => {
      if (!window.editor) return;
      const code = window.editor.getValue();
      const res = appendBvhToChain(code, nombre);
      if (res.error) {
        if (window.showError) window.showError(res.error, 6000);
        else console.error(res.error);
        return;
      }
      window.editor.setValue(res.code);
      if (typeof window.editor.posFromIndex === 'function' && typeof window.editor.setCursor === 'function') {
        window.editor.setCursor(window.editor.posFromIndex(res.cursorIndex));
      }
      if (typeof window.editor.focus === 'function') {
        window.editor.focus();
      }
      if (hoverPreviewContainer) hoverPreviewContainer.classList.remove('visible');
      if (iframePreview.contentWindow && window.runActiveSandbox) window.runActiveSandbox();
    });

    bvhList.appendChild(btn);
  });

}
