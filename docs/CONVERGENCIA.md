# Convergencia MoveScript (Rama refactor)

## Decisiones Cerradas

- Una sola rama (refactor), un núcleo común (core, engine, dsl, ui, shared),
  dos perfiles con una capa src/platform/ (interfaz + capabilities).
- WEB: sitio estático puro. Sin Socket.IO, sin túnel, sin VR, sin BVH locales.
  Esas funciones no deben existir en el bundle web (no basta con ocultarlas).
- ESCRITORIO (Electron): funciona 100 % sin internet. Sin fallback a CDN.
  Orden de resolución de BVH: carpeta del usuario MoveScript_BVH, luego
  globales empaquetados, si no existe error claro.
- VR en escritorio: debe funcionar sin internet (red local, el Quest en la
  misma wifi). El botón "Start VR Tunnel" crea además un túnel por internet
  (Pinggy) como opción adicional.
- Estados por colores del botón VR (heredados de la rama vr):
    reposo: gris, texto "Start VR Tunnel"
    esperando: naranja, texto "Waiting VR Client..." (con spinner)
    conectado: verde, texto "VR Client Connected"
    desconectado: rojo, texto "VR Disconnected" (a los 4 s vuelve a naranja
    si el túnel sigue activo)
    al cerrar la terminal del túnel: vuelve a gris
- Seguridad del servidor de performance: token de sesión aleatorio en la URL,
  el visor VR solo recibe (solo el editor local emite update_code), CORS
  restringido, lista blanca de rutas (nunca express.static(__dirname)),
  el visor ejecuta el DSL con el mismo with+Proxy de refactor (nunca
  new Function libre).
- Electron: contextIsolation true, nodeIntegration false, preload.js con API
  mínima, CSP estricta, validar nombres de archivo en saveBvh.
- Mantener las claves de localStorage actuales (movescript_sandboxes,
  movescript_sandbox_<id>, movescript_saved_code).
- Plan por fases (0 a 6): 0 línea base y cobertura, 1 empaquetado local con
  bundler y CSP, 2 capa platform/, 3 portar UX de vr (drawer con GIF,
  añadir al final de la cadena, box(), floor(), pool de estelas),
  4 Electron seguro con BVH locales y drag and drop, 5 servidor de
  performance con token + túnel + VR + OSC, 6 docs/README/releases y retirar vr.

## Línea base de cobertura (Actualizada)

*Nota:* La medición actual excluye `tests/**` mediante `--test-coverage-exclude` e incluye únicamente `src/**` mediante `--test-coverage-include`. La base anterior incluía `tests/setup.js`. Además, el motor de test nativo de Node.js solo reporta archivos cargados durante los tests; por tanto, `src/main.js` y `src/engine/bridge.js` no aparecen en este informe al no ser importados directamente por los tests unitarios (como alternativa para forzar el reporte de archivos no cargados al 0% se podría utilizar `c8` con `--all`).

| Archivo | Line % | Branch % | Funcs % | Líneas no cubiertas |
|---|---|---|---|---|
| **core/actions.js** | 100.00 | 100.00 | 100.00 | |
| **core/layout.js** | 100.00 | 100.00 | 100.00 | |
| **core/state.js** | 100.00 | 100.00 | 100.00 | |
| **dsl/transpile.js** | 100.00 | 97.14 | 100.00 | |
| **engine/api.js** | 100.00 | 100.00 | 52.38 | |
| **engine/bvh.js** | 71.43 | 32.00 | 35.09 | 33-41, 61-62, 65-68, 71, 181-182, 187-190, 199-200, 223-226, 239-245, 250-330, 350-351, 364-365, 374-378, 387-389, 409-410, 412-413, 435-441, 505-507, 517-521, 530-536 |
| **engine/context.js** | 65.17 | 61.90 | 76.92 | 45-46, 55-60, 87-90, 107-124, 127-136, 141-162 |
| **engine/scene.js** | 91.07 | 77.78 | 20.83 | 54-60, 104-106 |
| **engine/utils.js** | 93.18 | 72.73 | 77.78 | 46-47, 51-54 |
| **shared/protocol.js** | 100.00 | 80.00 | 100.00 | |
| **ui/animationList.js** | 68.48 | 33.33 | 66.67 | 12-14, 21-30, 32-33, 43-44, 49-56, 60-62, 80 |
| **ui/drawer.js** | 89.66 | 87.50 | 100.00 | 17-19 |
| **ui/events.js** | 100.00 | 100.00 | 100.00 | |
| **ui/helpSidebar.js** | 100.00 | 78.57 | 100.00 | |
| **ui/sandbox.js** | 75.58 | 62.75 | 60.87 | 61-71, 78-98, 102-106, 113-116, 120-121, 137-139, 155-156, 172-176, 193-194, 214-215, 217-219, 239-240, 245, 269-271, 283-284, 286-287, 290-293 |
| **ui/sandboxWindow.js** | 61.54 | 45.45 | 54.84 | 46-53, 56-57, 108-119, 182-185, 188-189, 192-196, 205-207, 210-212, 215-219, 253-338 |
| **ui/storage.js** | 100.00 | 62.50 | 100.00 | |
| **TOTAL** | **78.81%** | **72.16%** | **54.93%** | |

## Umbrales Configurados en CI (`package.json`)
- Líneas (`--test-coverage-lines`): **75** (Base: 78.81%)
- Ramas (`--test-coverage-branches`): **69** (Base: 72.16%)
- Funciones (`--test-coverage-functions`): **50** (Base: 54.93%)

## Tests E2E de Humo Añadidos (Red de seguridad Fase 1)
1. `smoke: engine communication and default execution without error toast`: Verifica que la aplicación carga, se ejecuta la ejecución por defecto y no aparece el toast de error.
2. `smoke: network request for BVH assets succeeds on execution`: Verifica la comunicación y el intento de carga de assets BVH al ejecutar comandos en el editor.
3. `smoke: multiple windows maintain isolated sandbox contexts`: Verifica que al crear múltiples ventanas/sandboxes se mantienen contextos y editores aislados sin mezclarse.

## Estado de Pruebas y Lint
- **Lint (`npm run lint`):** Pasa correctamente sin errores ni advertencias.
- **Tests Unitarios (`npm test`):** 36/36 tests pasando.
- **Tests E2E (`npm run test:e2e`):** 11/11 tests pasando (incluyendo los 3 nuevos tests de humo).
