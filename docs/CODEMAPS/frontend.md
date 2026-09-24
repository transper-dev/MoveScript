<!-- Generated: 2026-09-24 | Files scanned: ~7 | Token estimate: ~610 -->
# Frontend Architecture

## Pages / page tree
- `index.html` (main interface)
  - Preview: `iframe#preview` (loads VR renderer content)
  - Editor overlay: CodeMirror instance bound to `#code`
  - Controls: Run, Pause/Play, Save, Random, Toggle editor, BVH drawer
  - Error toast: shows errors received from `bvhApi.js`

- `visor.html` (VR client)
  - Canvas created in `bvhApi.js`
  - Socket.IO client
  - Forwards:
    - `osc_data` -> `socket.emit('vr_data', ...)`
    - `execute_code` -> `window.postMessage({type:'execute', code})`

## UI state & message flow

```text
index.html
  - user types DSL
  - run() => iframe.postMessage({type:'execute', code})
  - also socket.emit('update_code') => server broadcasts execute_code

bvhApi.js (iframe/visor instance)
  - listens to window.message: {type:'execute'} and runs DSL
  - sends back {type:'error'} and editing telemetry:
      rigSelected/rigMoved/rigRotated/chainStep
```

## Rendering / engine
- `bvhApi.js`
  - WebGLRenderer + WebXR enabled (VRButton)
  - DSL execution: `window.bvh(fileOrUrl)` returns a handle with chainable modifiers
  - Tick loop via `renderer.setAnimationLoop(animate)`
  - Animation mixers per rig
  - Trails: clones geometry+material and disposes on expiry
  - Selection system: raycast + compute bounds

- `main.js` (local Three.js VR bootstrap)
  - Initializes renderer, camera rig, controller models
  - Posts `{type:'vr_start'}` / `{type:'vr_end'}` to parent

## Key files
- `index.html`, `main.js`, `visor.html`, `bvhApi.js`.
