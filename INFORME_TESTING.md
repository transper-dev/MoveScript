---
---

# Informe de Auditoría de Testabilidad y Estrategia de Testing - MoveScript

## 1. Diagnóstico de Testabilidad Actual

Tras la auditoría del código fuente, el estado de testabilidad de MoveScript es el siguiente:

### Puntos Fuertes (Fáciles de testear)
- **`dsl/transpile.js`**: Funciones puras (`parseBlocks`, `transpileBlock`) que manipulan strings y arrays sin dependencias externas. Ideales para **tests unitarios puros**.
- **`shared/protocol.js`**: Constantes y funciones utilitarias de mensajería (`createMessage`, `isMessageType`). Son puramente funcionales y fáciles de validar.

### Puntos de Fricción (Requieren ajustes/mocks)
- **`engine/api.js`**: Depende de `ctx` (Three.js context/scene) y `new Function` con `Proxy` para la ejecución sandbox. El testing requiere **mockear profundamente el `ctx`** y la API de Three.js.
- **`ui/main.js`**: Altamente acoplado al DOM (`document.getElementById`, iframes, `postMessage`). La interacción con `iframe.contentWindow` requiere **mocks de JSDOM/HappyDOM** o pruebas con navegador real (Playwright).
- **Persistencia**: `ui/storage.js` depende de `localStorage`. Necesita un **mock de la API de Storage** en tests unitarios.

## 2. Catálogo de Tipos de Tests Aplicables

### a) Tests Unitarios Puros
- **¿POR QUÉ?**: Garantizar que el DSL traduce código a JS sin errores sintácticos.
- **¿QUÉ?**: `dsl/transpile.js`. Casos: bloques con comentarios, strings con brackets `[bvh("dummy")]`, comentarios, múltiples bloques unidos por `>`.
- **¿CÓMO?**: Vitest/Jest.
  ```javascript
  // Ejemplo:
  import { parseBlocks, transpileBlock } from './dsl/transpile.js';
  test('transpileBlock con un bloque', () => {
    const block = { parts: ['[bvh("dummy")]'] };
    expect(transpileBlock(block)).toBe('CHAIN($B().bvh("dummy"))');
  });
  ```

### b) Tests del Motor 3D (Headless Three.js)
- **¿POR QUÉ?**: Verificar la lógica geométrica y de animación de Three.js sin requerir un navegador real ni GPU.
- **¿QUÉ?**: `engine/` (Scene, Bone, Group, Vector3, Box3, AnimationMixer, BVHLoader).
- **¿CÓMO?**: Ejecución en Node.js cargando `three` real.
  - **Mocks necesarios**: `WebGLRenderer` (escribir un mock que acepte un canvas dummy), `OrbitControls` (mockear los métodos de control), `window`/`document` (usar JSDOM para simular la existencia de `canvas` y elementos DOM).
  - **Instancias reales**: Mantener instancias reales de `THREE.Scene`, `THREE.PerspectiveCamera`, `THREE.Clock`, `THREE.AnimationMixer`, y `THREE.BVHLoader`.

### c) Tests de Integración del Motor y Sandboxes
- **¿POR QUÉ?**: Verificar que `executeInSandbox` protege el scope correctamente.
- **¿QUÉ?**: `executeInSandbox` en `engine/api.js`. Probar intentos de acceso a `window`, `document`.
- **¿CÓMO?**: Test de seguridad usando un entorno `node:vm` o un `iframe` aislado para validar la prohibición de acceso a APIs prohibidas.

### d) Tests de Integración de Comunicación
- **¿POR QUÉ?**: Asegurar que `main.js` e `iframe` (`bvhApi.js`) se comunican correctamente.
- **¿QUÉ?**: `shared/protocol.js` y el manejo de `postMessage` en `main.js`.
- **¿CÓMO?**: Playwright. Disparar `postMessage` en el padre y verificar que el iframe responde con `READY` o `ERROR`.

### e) Tests End-to-End (E2E)
- **¿POR QUÉ?**: Flujo crítico del usuario: escribir -> transpilar -> renderizar.
- **¿QUÉ?**: Interacción total: CodeMirror -> botón Run -> Canvas del iframe -> validación visual.
- **¿CÓMO?**: Playwright.
  ```javascript
  // Ejemplo E2E:
  test('renderizado básico', async ({ page }) => {
    await page.goto('/');
    await page.fill('.CodeMirror textarea', '[bvh("dummy")]');
    await page.click('#runAllBtn');
    await expect(page.locator('canvas')).toBeVisible();
  });
  ```

---

## 3. Matriz de Prioridad (ROI vs. Esfuerzo)

| Tipo de Test | ROI | Esfuerzo | Prioridad |
| :--- | :--- | :--- | :--- |
| **Unitarios (DSL)** | Muy Alto | Muy Bajo | **Crítica** |
| **Motor 3D (Headless)**| Alto | Alto | **Alta** |
| **Unitarios (Protocol)**| Alto | Bajo | **Alta** |
| **Integración (Coms)** | Alto | Medio | **Media** |
| **E2E (Flujo)** | Muy Alto | Alto | **Alta** |
| **Visual/Rendimiento** | Medio | Alto | **Baja** |

---

## 4. Hoja de Ruta de Implementación

1. **Setup**: Instalar `vitest` y `playwright` (o usar `node --test` para tests nativos).
2. **Estructura**: Crear carpeta `tests/` con subcarpetas `engine/`, `unit/`, `integration/`, `e2e/`.
3. **Paso 1**: Proteger la lógica de transpilación y el motor 3D (las más críticas).
4. **Paso 2**: Implementar tests de integración básicos de comunicación.
5. **Paso 3**: E2E para el "Happy Path".

