import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { getCtx, contexts } from '../engine/context.js';
import { buildApi, executeInSandbox } from '../engine/api.js';
import { scene, camera, renderer, clock, controls } from '../engine/scene.js';
import { incrementFrameCount } from '../engine/utils.js';

const status = document.getElementById('status');
const enterVr = document.getElementById('enter-vr');
const socket = window.io({ transports: ['websocket', 'polling'] });
let lastVrSend = 0;

function setStatus(message) {
  status.textContent = message;
}

renderer.xr.enabled = true;
const player = new THREE.Group();
player.position.set(0, 0, 6); // Position user 6 meters back from the models
scene.add(player);
player.add(camera);

const controllers = [renderer.xr.getController(0), renderer.xr.getController(1)];
controllers.forEach(controller => player.add(controller));

function handleExecuteCode(payload) {
  const sandboxId = typeof payload === 'object' && payload !== null ? (payload.sandboxId || 'default') : 'default';
  const order = typeof payload === 'object' && payload !== null && Number.isInteger(payload.order) ? payload.order : 0;
  const code = typeof payload === 'string' ? payload : (payload?.code || '');
  const type = typeof payload === 'object' && payload !== null ? payload.type : null;

  const ctx = getCtx(sandboxId, buildApi);
  ctx.order = order;

  if (type === 'clearSandbox') {
    ctx.destroy();
    return;
  }
  if (type === 'clearAll') {
    for (const c of Array.from(ctx.constructor.contexts || [ctx])) {
      c.destroy?.();
    }
    return;
  }

  ctx.clear();
  try {
    executeInSandbox(ctx, code);
    setStatus(`Connected · Sandbox ${sandboxId}`);
  } catch (err) {
    setStatus(`Sandbox ${sandboxId} error: ${err.message}`);
  }
}

function controllerData() {
  const read = controller => {
    if (!controller) return null;
    const position = new THREE.Vector3();
    controller.getWorldPosition(position);
    return [position.x, position.y, position.z];
  };
  return { c1: read(controllers[0]), c2: read(controllers[1]) };
}

function render(time, _frame) {
  const delta = clock.getDelta();
  incrementFrameCount();
  resize();
  controls?.update?.();
  for (const ctx of contexts.values()) {
    ctx.tick(delta);
  }
  if (time - lastVrSend > 33) {
    socket.emit('vr_data', controllerData());
    lastVrSend = time;
  }
  renderer.render(scene, camera);
}

window.addEventListener('resize', resize);
resize();

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

socket.on('connect', () => {
  socket.emit('xr_ready');
  setStatus('Connected · waiting for desktop code');
});
socket.on('disconnect', () => setStatus('Disconnected from desktop tunnel'));
socket.on('execute_code', payload => handleExecuteCode(payload));
socket.on('vr_status', ({ status: vrStatus }) => {
  if (vrStatus === 'connected') setStatus('VR client connected');
});

if (navigator.xr) {
  enterVr.addEventListener('click', async () => {
    try {
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
      await renderer.xr.setSession(session);
      renderer.xr.setReferenceSpaceType('local-floor');
    } catch (error) {
      setStatus(`WebXR unavailable: ${error.message}`);
    }
  });
  const vrButton = VRButton.createButton(renderer);
  vrButton.classList.add('xr-vr-button');
  vrButton.id = 'enter-vr';
  document.getElementById('overlay').replaceChild(vrButton, enterVr);
} else {
  enterVr.disabled = true;
  setStatus('WebXR is not available in this browser');
}

renderer.setAnimationLoop(render);
handleExecuteCode({ sandboxId: 'default', order: 0, code: '[bvh("deep_breath")]' });
