import { MessageTypes } from './shared/protocol.js';
import { canvas, renderer, scene, camera, controls, clock, setGlobalPause } from './engine/scene.js';
import {
  DEFAULT_SANDBOX, send,
  raycaster, mouse, selectionBox,
  getSelectedRig, setSelectedRig, deselect,
  incrementFrameCount
} from './engine/utils.js';
import { contexts, getCtx, allRigs } from './engine/context.js';
import { buildApi, executeInSandbox } from './engine/api.js';

// ====================================================
// RENDER LOOP
// ====================================================
function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

function tick() {
  const dt = clock.getDelta();
  incrementFrameCount();

  const selectedRig = getSelectedRig();
  if (selectedRig && selectionBox.visible) {
    const activeRig = selectedRig.ctx.rigs.find(r =>
      (r.handle === selectedRig.handle || r.handle._chainHead === selectedRig.handle) &&
      (r.handle._useDummy ? r.root.visible : (r.helper && r.helper.visible))
    );
    if (activeRig) selectionBox.setFromObject(activeRig.handle._useDummy ? activeRig.group : activeRig.helper);
  }

  for (const ctx of contexts.values()) ctx.tick(dt);
}

function animate() {
  resize();
  controls.update();
  tick();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// ====================================================
// SISTEMA DE SELECCIÓN (global: un único rig seleccionado en toda la escena)
// ====================================================
raycaster.params.Line.threshold = 20;
let editMode = "position";

window.addEventListener("pointerdown", (e) => {
  if (e.target !== canvas) return;

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const rigsNow = allRigs();
  const objectsToTest = [];
  rigsNow.forEach(r => {
    if (r.handle._useDummy) {
      objectsToTest.push(r.group);
    } else if (r.helper && r.helper.visible) {
      r.helper.geometry.computeBoundingSphere();
      r.helper.geometry.computeBoundingBox();
      objectsToTest.push(r.helper);
    }
  });

  const intersects = raycaster.intersectObjects(objectsToTest, true);

  if (intersects.length > 0) {
    const hitObject = intersects[0].object;

    const hitRig = rigsNow.find(r => {
      let found = false;
      if (r.helper === hitObject) found = true;
      r.group.traverse(child => { if (child === hitObject) found = true; });
      return found;
    });

    if (hitRig) {
      const selectedRig = getSelectedRig();
      const newlySelectedRig = hitRig.handle._chainHead
        ? (hitRig.ctx.rigs.find(r => r.handle === hitRig.handle._chainHead) || hitRig)
        : hitRig;

      if (selectedRig === newlySelectedRig) {
        editMode = (editMode === "position") ? "rotation" : "position";
      } else {
        if (selectedRig && selectedRig.ctx !== newlySelectedRig.ctx) send(MessageTypes.RIG_DESELECTED, selectedRig.ctx.id);
        setSelectedRig(newlySelectedRig);
        editMode = "position";
      }

      selectionBox.material.color.setHex(editMode === "position" ? 0xffff00 : 0x00ffff);

      const currentSelected = getSelectedRig();
      const activeRig = currentSelected.ctx.rigs.find(r =>
        (r.handle === currentSelected.handle || r.handle._chainHead === currentSelected.handle) &&
        (r.handle._useDummy ? r.root.visible : (r.helper && r.helper.visible))
      );
      if (activeRig) selectionBox.setFromObject(activeRig.handle._useDummy ? activeRig.group : activeRig.helper);

      selectionBox.visible = true;
      controls.enabled = false;

      send(MessageTypes.RIG_SELECTED, currentSelected.ctx.id, { codeIndex: currentSelected.handle._codeIndex });
    }
  } else {
    deselect(true);
  }
});

window.addEventListener("pointerup", () => { controls.enabled = true; });

window.addEventListener("keydown", (e) => {
  const selectedRig = getSelectedRig();
  if (!selectedRig) return;

  const ctx = selectedRig.ctx;
  const cadenaRigs = ctx.rigs.filter(r => r.handle === selectedRig.handle || r.handle._chainHead === selectedRig.handle);

  if (editMode === "position") {
    const step = e.shiftKey ? 20 : 5;
    let moved = false;
    let dx = 0, dz = 0;

    if (e.key === "ArrowUp")    { dz -= step; moved = true; }
    if (e.key === "ArrowDown")  { dz += step; moved = true; }
    if (e.key === "ArrowLeft")  { dx -= step; moved = true; }
    if (e.key === "ArrowRight") { dx += step; moved = true; }

    if (moved) {
      cadenaRigs.forEach(r => {
        r.group.position.x += dx;
        r.group.position.z += dz;
        r.handle._x = r.group.position.x;
        r.handle._z = r.group.position.z;
        r.handle._xExplicit = true;
      });

      send(MessageTypes.RIG_MOVED, ctx.id, {
        codeIndex: selectedRig.handle._codeIndex,
        x: selectedRig.group.position.x,
        z: selectedRig.group.position.z
      });
    }
  } else if (editMode === "rotation") {
    const angleStep = e.shiftKey ? 0.5 : 0.1;
    let rotated = false;
    let dRotX = 0, dRotY = 0;

    if (e.key === "ArrowLeft")  { dRotY += angleStep; rotated = true; }
    if (e.key === "ArrowRight") { dRotY -= angleStep; rotated = true; }
    if (e.key === "ArrowUp")    { dRotX -= angleStep; rotated = true; }
    if (e.key === "ArrowDown")  { dRotX += angleStep; rotated = true; }

    if (rotated) {
      cadenaRigs.forEach(r => {
        r.pivot.rotation.x += dRotX;
        r.pivot.rotation.y += dRotY;
        r.handle._rotX = r.pivot.rotation.x;
        r.handle._rotY = r.pivot.rotation.y;
      });

      send(MessageTypes.RIG_ROTATED, ctx.id, {
        codeIndex: selectedRig.handle._codeIndex,
        rotX: selectedRig.pivot.rotation.x,
        rotY: selectedRig.pivot.rotation.y
      });
    }
  }
});

// ====================================================
// MENSAJERÍA CON EL PARENT (todo con sandboxId)
// ====================================================
window.addEventListener("error", (event) => {
  send(MessageTypes.ERROR, null, { message: event.message });
});

window.addEventListener("message", (event) => {
  const d = event.data;
  if (!d || !d.type) return;
  const id = d.sandboxId ?? DEFAULT_SANDBOX;

  if (d.type === MessageTypes.EXECUTE) {
    const ctx = getCtx(id, buildApi);
    if (Number.isInteger(d.order)) ctx.order = d.order;
    try { executeInSandbox(ctx, d.code); }
    catch (error) { send(MessageTypes.ERROR, id, { message: error.stack || error.message }); }
  } else if (d.type === MessageTypes.PAUSE) {
    setGlobalPause(!!d.paused);
  } else if (d.type === MessageTypes.PAUSE_SANDBOX) {
    const ctx = contexts.get(id);
    if (ctx) ctx.paused = !!d.paused;
  } else if (d.type === MessageTypes.REMOVE_SANDBOX) {
    const ctx = contexts.get(id);
    if (ctx) ctx.destroy();
  } else if (d.type === MessageTypes.REMOTE_KEY) {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: d.key, shiftKey: d.shiftKey }));
  }
});

window.parent.postMessage({ type: MessageTypes.READY }, "*");
