import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
import { getXrBoneBounds, getXrTransform, parseXrCode } from './protocol.js';

const status = document.getElementById('status');
const enterVr = document.getElementById('enter-vr');
const socket = window.io({ transports: ['websocket', 'polling'] });
let activeRig = null;
let latestState = { file: 'deep_breath', color: null, color2: null, scale: 1, speed: 1, reverse: false };
const scene = new THREE.Scene();
const clock = new THREE.Clock();
scene.background = new THREE.Color('#05070a');
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.5));
const grid = new THREE.GridHelper(800, 40, 0x335555, 0x152222);
scene.add(grid);

const player = new THREE.Group();
player.position.set(0, 1.6, 6);
scene.add(player);
player.add(camera);

const controllers = [renderer.xr.getController(0), renderer.xr.getController(1)];
controllers.forEach(controller => player.add(controller));

let lastVrSend = 0;

function setStatus(message) {
  status.textContent = message;
}

function disposeRig() {
  if (!activeRig) return;
  scene.remove(activeRig.group);
  scene.remove(activeRig.helper);
  activeRig.mixer.stopAllAction();
  activeRig.mixer.uncacheRoot(activeRig.root);
  activeRig.helper.geometry.dispose();
  activeRig.helper.material.dispose();
  activeRig = null;
}

function loadAnimation(state) {
  latestState = state;
  disposeRig();
  const loader = new BVHLoader();
  const url = `./assets/bvh/${encodeURIComponent(state.file)}.bvh`;
  loader.load(url, result => {
    const root = result.skeleton.bones[0];
    const group = new THREE.Group();
    const pivot = new THREE.Group();
    pivot.add(root);
    group.add(pivot);

    group.updateMatrixWorld(true);
    const boneBounds = getXrBoneBounds(result.skeleton.bones);
    const transform = getXrTransform(boneBounds, state);
    group.scale.setScalar(transform.scale);
    if (state.dummy) root.visible = true;
    group.position.fromArray(transform.position);
    pivot.rotation.y = state.rotationY;
    const helper = new THREE.SkeletonHelper(root);
    helper.material.color.set(state.color || '#00ffcc');
    helper.material.linewidth = 3;
    scene.add(group, helper);
    group.updateMatrixWorld(true);
    helper.updateMatrixWorld(true);
    const mixer = new THREE.AnimationMixer(root);
    const action = mixer.clipAction(result.clip).play();
    mixer.timeScale = state.speed * (state.reverse ? -1 : 1);
    if (state.reverse) action.time = result.clip.duration;
    activeRig = { group, root, helper, mixer };
    setStatus(`Connected · ${state.file}`);
  }, undefined, error => setStatus(`Unable to load ${state.file}.bvh: ${error?.message || 'check the server URL'}`));
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
  if (activeRig) activeRig.mixer.update(clock.getDelta());
  if (time - lastVrSend > 33) {
    socket.emit('vr_data', controllerData());
    lastVrSend = time;
  }
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

socket.on('connect', () => {
  socket.emit('xr_ready');
  setStatus('Connected · waiting for desktop code');
});
socket.on('disconnect', () => setStatus('Disconnected from desktop tunnel'));
socket.on('execute_code', payload => loadAnimation(parseXrCode(payload)));
socket.on('vr_status', ({ status: vrStatus }) => {
  if (vrStatus === 'connected') setStatus('VR client connected');
});

if (navigator.xr) {
  enterVr.addEventListener('click', async () => {
    try {
      await renderer.xr.setSession(await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] }));
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
loadAnimation(latestState);
