# PASO 3 - Plan de Modularización de bvhApi.js

## Estado Actual (40% completado)

### ✅ Módulos Creados:
1. **engine/scene.js** (~75 líneas)
   - Configuración Three.js: scene, camera, renderer, controls
   - Funciones globales: setGrid, setCam, setBackground, setRot
   - Exports: canvas, scene, camera, renderer, controls, clock, globalPause

2. **engine/utils.js** (~90 líneas)
   - Constantes: DEFAULT_SANDBOX, SANDBOX_SPACING
   - Funciones: send, defaultParams, disposeRig, deselect
   - Selección: raycaster, mouse, selectionBox
   - frameCount management

3. **engine/context.js** (~190 líneas)
   - Clase SandboxContext con rigs, trails, timers
   - Métodos: later, every, cancel, clear, destroy, tick
   - Funciones: getCtx, allRigs
   - Map de contextos

**Total extraído: ~355 líneas de 973 (~36%)**

---

## ⏳ Pendiente (60% restante)

### Módulos por Crear:

#### 1. engine/bvh.js (~400 líneas)
**Contenido:**
- Función `createBvh(ctx, fileOrUrl, isChained)` (líneas 249-638 de bvhApi.js)
  - Handle con métodos: x, y, z, pos, rotX, rotY, rotZ, delay, scale, skeleton, speed, reverse, color, trail
  - Métodos especiales: dummy, bones, joints, play, nextBvh
  - Carga BVH con BVHLoader
  - Construcción de skeleton helper con colores/gradientes
  - Construcción de dummy meshes (spheres + cylinders)
  - Mixer y action setup
  - Chain handling con evento "finished"
  
- Función `duplicateHandle(ctx, originalHandle)` (líneas 642-665)
  - Duplica handles con propiedades copiadas
  - DUPLICATE_KEYS array

- Clase `RigNode` (líneas 667-687)

- Función `applyPropsToHandle(handle, props)` (líneas 689-708)

**Imports necesarios:**
```javascript
import * as THREE from "three";
import { BVHLoader } from "three/addons/loaders/BVHLoader.js";
import { scene } from './scene.js';
import { send, defaultParams } from './utils.js';
```

**Exports:**
```javascript
export { createBvh, duplicateHandle, RigNode, applyPropsToHandle };
```

---

#### 2. engine/api.js (~150 líneas)
**Contenido:**
- Función `makeChain(ctx)` (líneas 710-756)
  - Crea CHAIN con métodos de RigNode
  
- Función `buildApi(ctx)` (líneas 758-783)
  - Construye API del DSL para cada contexto
  - Métodos: clear, bvh, duplicate, speed, skeleton, scale, reverse, color, trail, delay, pause, grid, cam, background, bg, rot, $B, CHAIN
  
- Constante `API_NAMES` (línea 785)

- Función `executeInSandbox(ctx, code)` (líneas 788-794)
  - Ejecuta código DSL en contexto aislado

**Imports necesarios:**
```javascript
import { setGrid, setCam, setBackground, setRot, setGlobalPause } from './scene.js';
import { createBvh, duplicateHandle, RigNode, applyPropsToHandle, makeChain } from './bvh.js';
import { getCtx } from './context.js';
```

**Exports:**
```javascript
export { buildApi, executeInSandbox, API_NAMES };
```

---

#### 3. Actualizar bvhApi.js (~100 líneas finales)
**Mantener solo:**
- Imports de todos los módulos engine/
- Función `resize()` (líneas 796-799)
- Función `tick()` (líneas 801-813)
- Función `animate()` (línea 815)
- Message listeners (líneas 822-973)
- Inicialización: iframe.srcdoc, animate loop, window.parent.postMessage("ready")

**Estructura final:**
```javascript
// Imports de engine/
import { scene, camera, renderer, controls, clock, setGrid, setCam, setBackground, setRot, setGlobalPause } from './engine/scene.js';
import { send, frameCount, incrementFrameCount, raycaster, mouse, selectionBox, getSelectedRig, setSelectedRig, deselect } from './engine/utils.js';
import { contexts, getCtx, allRigs } from './engine/context.js';
import { createBvh } from './engine/bvh.js';
import { buildApi, executeInSandbox } from './engine/api.js';

// Código restante (resize, tick, animate, message handlers)
// ...
```

---

## Próximos Pasos

1. Crear `engine/bvh.js` con función createBvh completa
2. Crear `engine/api.js` con buildApi y executeInSandbox
3. Refactorizar `bvhApi.js` para importar todos los módulos
4. Verificar que todo funciona correctamente
5. Commit final de PASO 3 completo

---

## Beneficios de la Modularización

- **Reducción**: bvhApi.js de ~973 líneas a ~100 líneas (-90%)
- **Separación de responsabilidades**: cada módulo tiene un propósito claro
- **Mantenibilidad**: cambios en una funcionalidad afectan solo su módulo
- **Testabilidad**: cada módulo puede probarse independientemente
- **Reusabilidad**: módulos pueden importarse donde se necesiten

---

## Estructura Final de Archivos

```
MoveScript/
├── index.html (82 líneas - reducido de 810)
├── main.js (importa dsl/ y shared/)
├── bvhApi.js (100 líneas - reducido de 973)
├── styles/
│   ├── index.css
│   ├── base.css
│   ├── sandbox-window.css
│   ├── drawer.css
│   ├── help.css
│   └── toast.css
├── ui/
│   ├── drawer.js
│   ├── helpSidebar.js
│   └── animationList.js
├── dsl/
│   └── transpile.js
├── shared/
│   └── protocol.js
└── engine/
    ├── scene.js ✅
    ├── utils.js ✅
    ├── context.js ✅
    ├── bvh.js ⏳
    └── api.js ⏳
```
