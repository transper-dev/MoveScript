/**
 * Drawer - Control del cajón de animaciones BVH
 * Toggle abrir/cerrar el cajón inferior con las animaciones disponibles
 */

export function initDrawer() {
  const drawer = document.getElementById('bvh-drawer');
  const toggleBtn = document.getElementById('drawer-toggle');
  const toggleIcon = toggleBtn.querySelector('i');

  if (!drawer || !toggleBtn || !toggleIcon) {
    console.warn('Drawer elements not found');
    return;
  }

  toggleBtn.addEventListener('click', () => {
    drawer.classList.toggle('abierto');
    if (drawer.classList.contains('abierto')) {
      toggleIcon.className = 'fas fa-chevron-down';
    } else {
      toggleIcon.className = 'fas fa-chevron-up';
    }
  });
}