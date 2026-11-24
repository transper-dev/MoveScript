# MoveScript

MoveScript is a creative-coding environment for turning BVH motion-capture files into live 3D scenes. The editor uses a small declarative DSL for loading animations, chaining movements, changing playback, drawing trails, and controlling the shared Three.js scene.

## Profiles

### Web static profile

Open `index.html` from a static host such as GitHub Pages or the deployed web demo:

**[Open MoveScript](https://movescript.netlify.app/)**

The web profile provides the editor, Three.js preview, bundled BVH assets, animation drawer, help panel, and local browser persistence. It does not provide Electron-only local-file access, the VR tunnel, or OSC output.

### Electron desktop profile

Install dependencies and run:

```bash
npm install
npm start
```

Electron starts the editor and a local Express + Socket.IO server on `127.0.0.1:3000`. The server serves the packaged application and bundled files from `assets/`. Electron-only controls provide:

- Local BVH listing, reading, and saving through IPC.
- A Pinggy SSH reverse tunnel for sharing the local server.
- OSC output from VR controller telemetry.

User BVH files are kept in the application user-data directory under `MoveScript_BVH`; this directory is separate from the packaged `assets/` tree.

## WebXR viewer

The desktop server exposes a dedicated WebXR page at:

```text
/webxr.html
```

Open that URL from the public tunnel URL in a WebXR-capable browser or Meta Quest browser, then choose **Enter immersive VR**. The viewer:

1. Connects to the same-origin Socket.IO server.
2. Announces itself with `xr_ready` and receives the latest editor code.
3. Receives later `execute_code` messages whenever code is run in the Electron editor.
4. Loads the referenced bundled BVH animation and renders it in the immersive Three.js scene.
5. Sends controller positions as `vr_data` while connected.

The editor sends the original MoveScript source. The WebXR viewer interprets the supported animation and visual modifiers locally, so the static web profile remains independent of the desktop bridge.

## OSC bridge

When OSC is enabled in Electron, the server maps controller heights and sends them to `127.0.0.1:12000`:

- Left controller Y → `/vr/left_y`, bounded to `0–127`.
- Right controller Y → `/vr/right_y`, bounded to `1000–5000`.

The bridge is intended for OSC-compatible tools such as Max/MSP, SuperCollider, TouchDesigner, or other local OSC receivers.

## Project structure

```text
assets/                 Bundled BVH, GIF, documentation, and icon assets
config/                 ESLint and Playwright configuration
electron/               Electron main process, preload bridge, IPC validation, and desktop services
src/core/               Sandbox state, actions, and layout persistence
src/dsl/                MoveScript block parser and transpiler
src/engine/             Three.js scene, BVH loading, sandbox contexts, and iframe bridge
src/platform/           Web and Electron capability profiles
src/shared/             Parent/iframe message protocol
src/ui/                 Editor windows, tabs, drawer, help, storage, and desktop controls
src/xr/                 WebXR client and source-code interpretation helpers
tests/                  Node/jsdom unit tests and Playwright E2E tests
index.html              Main editor entry point
webxr.html              Dedicated WebXR entry point
electron/main.js        Electron application entry point
```

## Quick DSL example

```javascript
[bvh("deep_breath")]
>[dummy()]
>[color("red", "blue")]
>[trail(30)]
```

Use `>` between closed blocks to chain animation steps. Common modifiers include `color`, `pos`, `rotX`, `rotY`, `rotZ`, `scale`, `speed`, `reverse`, `skeleton`, `trail`, `bones`, `joints`, `box`, and `delay`.

## Editor controls

| Action | Shortcut |
| --- | --- |
| Run current sandbox | `Ctrl + Enter` |
| Run all sandboxes | `Ctrl + Shift + Enter` |
| Pause all sandboxes | `Ctrl + P` |
| Save current sandbox | `Ctrl + S` |
| Hide/show current window | `Esc` |

The editor supports multiple sandbox windows, tabs, drag-and-drop tab movement, resizing, local browser persistence, scene selection, and keyboard movement/rotation of selected rigs.

## Development commands

```bash
npm test             # Node test suite
npm run lint         # ESLint for src/ and electron/
npm run test:e2e     # Playwright Chromium tests
npm run test:coverage
```

The CI workflow runs linting, unit tests with coverage, and Playwright E2E tests.

## Dependencies

- Electron
- Express
- Socket.IO
- Three.js
- CodeMirror
- Playwright
- jsdom
- node-osc

## License

ISC
