# CONVERGENCIA.md

## Plataforma
El proyecto utiliza una capa de abstracción en `src/platform/` para manejar diferencias entre entornos (web, desktop).
- La selección se realiza en tiempo de compilación mediante la variable global `__MS_PROFILE__` (web/desktop), definida en `vite.config.js`.
- El contrato del objeto platform incluye:
  - `capabilities`: { localBvh: bool, vr: bool, tunnel: bool, osc: bool, autoUpdate: bool }
  - `bvh.list()`: Retorna un array de objetos `{name: string, source: string}`.
  - `bvh.resolveUrl(name)`: Resuelve el path relativo. Restricciones:
    - No URLs http(s) en web (lanzan error: "no permitido en la versión web").
    - Subcarpetas permitidas hasta un nivel.
    - Rechazo de '..', '\\', '%'.

## Notas
- **Three.js**: `THREE.Clock` está deprecado, usar `THREE.Timer` es la meta futura (deuda técnica).

## Fases y Funcionalidades
- **Fase 3A/3A-bis**: Deuda de tests cerrada, GIFs portados, Drawer UX con previsualizaciones flotantes, y lógica DSL `appendBvhToChain`.
- **Fase 3B**:
    - **box(n, dist)**: Modificador de esqueleto, cajas en `scene`, margen `i*dist*60` sobre bounding box estricto, n<=30, dist<=10, `EdgesGeometry` compartida.
    - **floor(color, size)**: Defaults, límites [1,10000], y=-1, validación color propia (`isValidColor`), `floor(false)`.
    - **Estelas (trails)**: Pool por rig, tope 2000, `trail<=600`.
    - **Corregido**: `box()` (cajas a `scene`, medición estricta), `floor()` (validación color), `runner.js` (TypeError en `sortedByLabelFunc`), tests e2e/unitarios, cobertura.

## Deudas Técnicas
- **UI/Errors**: `showError` (pasar como parámetro frente a `window.showError`, fase 6).
- **Arquitectura**: Cabeceras Global/Local (fase 4).
- **DSL**: Peso de `dist/` y GIFs (fase 6).
- **Seguridad**: El sandbox del DSL se salta con `speed.constructor('...')()` y `Math.constructor.constructor(...)`; debe resolverse antes de la fase 5.
- **THREE.Clock**: Sustitución por `THREE.Timer` (fase 7).
