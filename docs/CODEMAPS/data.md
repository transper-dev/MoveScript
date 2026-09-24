<!-- Generated: 2026-09-24 | Files scanned: ~7 | Token estimate: ~420 -->
# Data

## Persistent stores
- **Filesystem (BVH assets)**
  - Packaged: `assets/bvh/*.bvh`
  - User custom path: `MoveScript_BVH/` (created at runtime if missing)
  - Generated index: `assets/bvh/lista.json` (from `generar-lista.js`)

## In-memory data (runtime)
- **Scene objects (Three.js)**
  - `rigs[]`: handles/controllers for BVH skeleton instances
  - `mixers[]`: AnimationMixer per rig
  - `activeTrails[]`: temporary LineSegments with cloned geometry/material

- **Editor state**
  - `activeChainMarks`, `currentChainSteps`, color CodeMirror widgets
  - `localStorage['movescript_saved_code']`

## Migrations / schema
- No DB schema present.
- Data changes are limited to new BVH files and regenerated `lista.json`.
