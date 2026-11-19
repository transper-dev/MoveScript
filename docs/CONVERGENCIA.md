# CONVERGENCIA.md

## Plataforma
El proyecto utiliza una capa de abstracción en `src/platform/` para manejar diferencias entre entornos (web, desktop).
- La selección se realiza en tiempo de compilación mediante la variable global `__MS_PROFILE__` (web/desktop), definida en `vite.config.js`.
- El contrato del objeto platform incluye:
  - `capabilities`: { localBvh: bool, vr: bool, tunnel: bool, osc: bool, autoUpdate: bool }
  - `bvh.list()`: Retorna un array plano de nombres de animaciones (fuente `global`).
  - `bvh.resolveUrl(name)`: Resuelve el path relativo. Restricciones:
    - No URLs http(s) en web (lanzan error: "no permitido en la versión web").
    - Subcarpetas permitidas hasta un nivel.
    - Rechazo de '..', '\\', '%'.

## Notas
- **Three.js**: `THREE.Clock` está deprecado, usar `THREE.Timer` es la meta futura (deuda técnica).
- **Validación**:
  - `src/app/` y lógica de UI se validan mediante E2E (`tests/e2e/`) y tests unitarios (`tests/persistence.test.js`, `tests/insertBvh.test.js`, etc.).
  - Fase 3A completada: Deuda de tests cerrada, GIFs portados a `public/assets/gifs/`, Drawer UX con previsualizaciones flotantes en hover, y lógica DSL de `appendBvhToChain` implementada y probada.
