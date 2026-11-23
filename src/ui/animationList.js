/**
 * AnimationList - Carga y renderizado de la lista de animaciones BVH
 * Busca animaciones en: local (Electron), lista.json local, CDN remoto
 * Inserta la animación seleccionada en el editor activo
 */

import { capabilities } from '../platform/index.js';

export async function initAnimationList() {
  const bvhList = document.getElementById('bvh-list');
  const iframePreview = document.getElementById('preview');

  if (!bvhList) {
    console.warn('BVH list element not found');
    return;
  }

  let animacionesGlobales = [];
  let animacionesLocales = [];

  // 1. Cargar globales (Web + Desktop)
  try {
    const response = await fetch('./assets/bvh/lista.json');
    if (response.ok) {
      animacionesGlobales = await response.json();
    } else if (!capabilities.hasLocalBvh && navigator.onLine) {
      const urlNube = 'https://cdn.jsdelivr.net/gh/transper-dev/MoveScript@main/assets/bvh/lista.json';
      const res = await fetch(urlNube);
      if (res.ok) animacionesGlobales = await res.json();
    }
  } catch (e) { console.warn("Error cargando globales"); }

  if (animacionesGlobales.length === 0) {
    animacionesGlobales = ["turn", "silly_walk", "monster_walk", "serious_walk"];
  }

  // 2. Cargar locales si aplica (Desktop)
  if (capabilities.hasLocalBvh) {
    try {
      animacionesLocales = await window.electronAPI.listLocalBvh();
    } catch (e) { console.warn("Error cargando locales"); }
  }

  const hoverContainer = document.getElementById('hover-preview-container');
  const hoverImage = document.getElementById('hover-preview-image');

  function renderItem(nombre, esLocal = false) {
    const btn = document.createElement('div');
    btn.className = `bvh-item ${esLocal ? 'local' : 'global'}`;
    const span = document.createElement('span');
    span.textContent = nombre;
    btn.appendChild(span);

    btn.addEventListener('mouseenter', () => {
      span.textContent = `ADD ${nombre}`;
      if (hoverContainer && hoverImage) {
        hoverImage.src = `./assets/gifs/${nombre}.gif`;
        hoverImage.onerror = () => hoverContainer.classList.remove('visible');

        const rect = btn.getBoundingClientRect();
        hoverContainer.style.left = `${rect.left}px`;
        hoverContainer.style.top = `${rect.top - 100}px`;
        hoverContainer.classList.add('visible');
      }
    });

    btn.addEventListener('mouseleave', () => {
      span.textContent = nombre;
      if (hoverContainer) hoverContainer.classList.remove('visible');
    });

    btn.addEventListener('click', () => {
      if (!window.editor) return;
      let code = window.editor.getValue().trim();
      const newBvh = `[bvh("${nombre}")]`;

      if (code === "") {
        code = newBvh;
      } else {
        if (code.endsWith(']')) {
          code += `\n>${newBvh}`;
        } else {
          code += `\n\n${newBvh}`;
        }
      }

      window.editor.setValue(code);
      if (iframePreview.contentWindow && window.runActiveSandbox) window.runActiveSandbox();
    });

    return btn;
  }

  // Limpiar lista de forma limpia sin innerHTML
  while (bvhList.firstChild) {
    bvhList.removeChild(bvhList.firstChild);
  }

  // Renderizar Locales
  if (capabilities.hasLocalBvh) {
    const sectionTitle = document.createElement('h3');
    sectionTitle.className = 'drawer-section-title';
    sectionTitle.textContent = 'LOCAL';
    bvhList.appendChild(sectionTitle);

    animacionesLocales.forEach(nombre => {
      bvhList.appendChild(renderItem(nombre, true));
    });

    const btnNew = document.createElement('div');
    btnNew.className = 'bvh-item new-bvh';
    const spanNew = document.createElement('span');
    spanNew.textContent = '+ NEW BVH';
    btnNew.appendChild(spanNew);

    btnNew.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.bvh';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (re) => {
          try {
            await window.electronAPI.saveLocalBvh(file.name, re.target.result);
            await initAnimationList(); // Actualización limpia de la lista sin recarga completa
          } catch (err) {
            console.error(err.message);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });
    bvhList.appendChild(btnNew);
  }

  // Renderizar Globales
  const globalTitle = document.createElement('h3');
  globalTitle.className = 'drawer-section-title';
  globalTitle.textContent = 'GLOBAL';
  bvhList.appendChild(globalTitle);

  animacionesGlobales.filter(n => n !== 'dummy').forEach(nombre => {
    bvhList.appendChild(renderItem(nombre, false));
  });
}
