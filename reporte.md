requisito | archivo:línea | NOMBRE exacto del test
--- | --- | ---
Correct `box()` scaling | src/engine/bvh.js:370 | box: n cajas creadas por createBvh
Boxes added to `scene` | src/engine/bvh.js:372 | box: las cajas creadas por bvh.js tienen parent === scene (no group)
Strict bounding box | src/engine/context.js:120 | box: variante _useDummy y group.scale = 100 coincide con bounding box estricto
Color validation | src/engine/scene.js:14 | floor: invalid color uses default and warns
Color fallback | src/engine/scene.js:28 | floor: invalid color uses default and warns
Hex/RGB/HSL validation | src/engine/scene.js:5 | floor: valid color formats including red and 0xff0000
Coverage threshold 83/45/62 | package.json:8 | N/A (config)
Trail Pool reuse | src/engine/context.js:149 | trail: un snapshot consume una malla del pool sin geometry.clone
Trail color | src/engine/context.js:165 | trail: dos rigs con colores distintos: cada estela con el color de SU helper
Trail limits | src/engine/bvh.js:67 | trail: limites acotados a [0, 600]
Trail max 2000 | src/engine/context.js:143 | trail: tope de 2000 estelas activas se respeta
Trail clear | src/engine/context.js:86 | trail: clear() limpia todo, scene.children y dispone
Trail static | src/engine/context.js:142 | trail: estela capturada no se mueve con el helper
Trail resize | src/engine/context.js:156 | trail: cambia numero de vertices -> recrea geometria
DSL error toast | src/dsl/insertBvh.js:29 | Phase 3B Block 0: Error Toast › should show error toast...
DSL append chain | src/dsl/insertBvh.js:41 | DSL Transpiler - detect multiple blocks...
Runner EXECUTE | src/app/runner.js:56 | Runner - correctly posts EXECUTE message
