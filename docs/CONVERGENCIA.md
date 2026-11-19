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
  - `src/app/` y lógica de UI se validan principalmente mediante E2E (`tests/e2e/`) y tests unitarios nuevos (`tests/persistence.test.js`, etc.).
  - Faltan assets de visualización en `public/assets/gifs/` para la fase 3.
