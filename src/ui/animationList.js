/**
 * AnimationList - Carga y renderizado de la lista de animaciones BVH
 * Busca animaciones en: local (Node), lista.json local, CDN remoto
 * Inserta la animación seleccionada en el editor activo
 */

export async function initAnimationList() {
  const bvhList = document.getElementById('bvh-list');
  const iframePreview = document.getElementById('preview');

  if (!bvhList) {
    console.warn('BVH list element not found');
    return;
  }

  let animacionesDisponibles = [];

  // 1. Intentar cargar desde el sistema local (Node.js)
  try {
    if (typeof require !== 'undefined') {
      const fs = require('fs');
      const path = require('path');
      const rutaAssets = path.join(__dirname, 'assets');
      if (fs.existsSync(rutaAssets)) {
        const archivos = fs.readdirSync(rutaAssets);
        animacionesDisponibles = archivos
          .filter(archivo => archivo.endsWith('.bvh'))
          .map(archivo => archivo.replace('.bvh', ''));
      }
    }
  } catch (e) {
    console.warn("Local no disponible");
  }

  // 2. Intentar cargar desde lista.json local
  if (animacionesDisponibles.length === 0) {
    try {
      const response = await fetch('./assets/lista.json');
      if (response.ok) {
        animacionesDisponibles = await response.json();
      }
    } catch (e) {
      console.warn("No se pudo leer el lista.json local");
    }
  }

  // 3. Intentar cargar desde CDN
  if (animacionesDisponibles.length === 0 && navigator.onLine) {
    try {
      const urlNube = 'https://cdn.jsdelivr.net/gh/transper-dev/MoveScript@main/assets/lista.json';
      const response = await fetch(urlNube);
      if (response.ok) animacionesDisponibles = await response.json();
    } catch (e) {
      console.warn("Nube bloqueada temporalmente");
    }
  }

  // 4. Fallback si nada funciona
  if (animacionesDisponibles.length === 0) {
    console.warn("Cargando animaciones de emergencia.");
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
        let salto = code.trim() !== "" ? "\n\n" : "";
        code += `${salto}[bvh("${nombre}")]`;
      }

      window.editor.setValue(code);
      if (iframePreview.contentWindow && window.runActiveSandbox) window.runActiveSandbox();
    });

    bvhList.appendChild(btn);
  });
}