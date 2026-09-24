<!-- Generated: 2026-09-24 | Files scanned: ~7 | Token estimate: ~520 -->
# Backend Architecture

## Services
- **Electron main process**: hosts server + serves static assets.
- **Socket.IO relay**: broadcasts editor code updates to visor clients.
- **OSC bridge**: forwards controller poses at ~60fps to `localhost:12000`.

## Express + static routing
- `GET /assets` -> custom BVH folder on disk (`MoveScript_BVH` under user/Documents depending on platform)
- `GET /assets` -> packaged `assets/bvh`
- `GET /` -> served files in repo root (includes `index.html`, `visor.html`)
- `GET /build/` -> Three.js build artifacts from local `node_modules`
- `GET /jsm/` -> Three.js examples modules from local `node_modules`

## Socket.IO events
- `connection` (inspect UA/referer; emits `vr_status` for Quest vs local)
- `update_code` (from editor): `socket.broadcast.emit('execute_code', data)`
- `vr_data` (from visor): rate-limit and send OSC
- `disconnect`: emits `vr_status` when VR UA detected

## OSC
- Client: `node-osc` to `127.0.0.1:12000`
- Address: `/vr/controllers`
- Payload: grouped controller positions/rotations (left/right)

## Key files
- `main-electron.js`: server + tunnel bootstrap + socket + OSC.
- `generar-lista.js`: scans `assets/bvh` and writes `assets/bvh/lista.json`.
- `visor.html` + `bvhApi.js`: emit `vr_data` via socket (through postMessage chain).
