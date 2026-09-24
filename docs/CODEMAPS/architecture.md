<!-- Generated: 2026-09-24 | Files scanned: ~7 | Token estimate: ~650 -->
# Architecture

## Runtime shape

```
Electron (main process)
  ├─ Express static + health
  ├─ Socket.IO (PC <-> visor)
  └─ node-osc (visor -> OSC localhost:12000)

Web UI pages
  ├─ index.html (editor/controller)
  │    └─ iframe -> bvhApi.js (Three.js + editor execution)
  └─ visor.html (VR renderer)
       └─ bvhApi.js (Three.js + WebXR + controller sampling)
```

## Main data flow

```text
Editor (index.html)
  1) user edits DSL in CodeMirror
  2) Ctrl+Enter => run() => postMessage({type:'execute'}) to iframe/bvhApi
  3) emits Socket.IO 'update_code' => Electron server broadcasts 'execute_code'

Visor (visor.html -> bvhApi.js)
  4) receives 'execute_code' via socket
  5) postMessage({type:'execute'}) into its bvhApi instance
  6) each animation tick sends controller poses as postMessage 'osc_data'

Electron server
  7) visor 'osc_data' -> socket 'vr_data'
  8) server rate-limits (~60fps) and sends OSC '/vr/controllers'
```

## Key boundaries
- **Rendering/World**: `bvhApi.js` (Three.js scene, BVH loading, animation mixers, trails, editing/selection).
- **VR client**: `visor.html` + `main.js` (WebXR bootstrap / controller models in `main.js`).
- **Editor/UI + code execution**: `index.html` (CodeMirror, highlights, run/pause/save) + iframe instance of `bvhApi.js`.
- **Server coordination**: `main-electron.js` (Express, Socket.IO, OSC bridge, custom BVH static path).

## Entry points
- Electron main: `main-electron.js`
- Editor: `index.html`
- VR renderer bootstrap: `visor.html`
- Rendering engine: `bvhApi.js`
- Local VR controller bootstrap: `main.js`
