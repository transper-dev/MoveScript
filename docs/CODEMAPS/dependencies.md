<!-- Generated: 2026-09-24 | Files scanned: ~7 | Token estimate: ~540 -->
# Dependencies

## Runtime deps (package.json)
- `express` - static hosting of app assets/pages
- `socket.io` - PC/editor <-> visor code sync + VR telemetry channel
- `node-osc` - OSC bridge to `localhost:12000`

## Dev/build deps
- `electron`, `electron-builder`

## Frontend libs
- `three` (via ESM for `visor.html` and locally served for app)
- Three addons used in `main.js`:
  - `OrbitControls`, `BVHLoader`, `VRButton`, `XRControllerModelFactory`
- `codemirror` (loaded from CDN in `index.html`)

## Key file/class boundaries
- Three WebXR is initialized in `bvhApi.js` (main render engine) and/or `main.js` (local VR controller models).
- Editor DSL parsing/execution is implemented in `bvhApi.js` (string transforms + DSL runtime objects).
