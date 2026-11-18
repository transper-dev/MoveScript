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

*Nota:* La medición estándar (usando `node --test`) excluye `tests/**` y limita a `src/**`.
La medición "full" (usando `c8 --all`) ofrece una visión completa de todos los archivos en `src/**`, incluyendo aquellos no cargados directamente por los tests unitarios.

**Informe Full (c8 --all):**
- Total Line %: **60.93%**
- Archivos al 0% (`main.js`, `bridge.js`): Se validan únicamente mediante tests E2E.

| Archivo | Line % | Branch % | Funcs % | Líneas no cubiertas |
|---|---|---|---|---|
| **core/actions.js** | 100.00 | 100.00 | 100.00 | |
| **core/layout.js** | 100.00 | 100.00 | 100.00 | |
| **core/state.js** | 100.00 | 100.00 | 100.00 | |
| **dsl/transpile.js** | 99.33 | 96.59 | 100.00 | 67-68 |
| **engine/api.js** | 100.00 | 100.00 | 52.38 | |
| **engine/bvh.js** | 71.42 | 32.00 | 29.54 | ... |
| **engine/context.js** | 65.16 | 61.90 | 90.00 | ... |
| **engine/scene.js** | 91.07 | 86.66 | 21.73 | 54-60, 104-106 |
| **engine/utils.js** | 93.18 | 75.00 | 85.71 | 46-47, 51-54 |
| **shared/protocol.js** | 100.00 | 80.00 | 100.00 | 27 |
| **ui/animationList.js** | 68.47 | 33.33 | 100.00 | ... |
| **ui/drawer.js** | 89.65 | 87.50 | 100.00 | 17-19 |
| **ui/events.js** | 100.00 | 100.00 | 100.00 | |
| **ui/helpSidebar.js** | 100.00 | 78.57 | 100.00 | 19,25,35 |
| **ui/sandbox.js** | 75.57 | 62.74 | 92.85 | ... |
| **ui/sandboxWindow.js** | 61.53 | 44.18 | 78.94 | ... |
| **ui/storage.js** | 100.00 | 62.50 | 100.00 | 7-9 |
| **src/main.js** | 0.00 | 0.00 | 0.00 | 1-427 |
| **src/engine/bridge.js** | 0.00 | 0.00 | 0.00 | 1-218 |
| **TOTAL** | **60.93%** | **72.05%** | **58.02%** | |


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
