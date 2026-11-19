/**
 * Scene - Configuración de la escena Three.js compartida
 * Escena, cámara, renderer, luces, controles y configuración global
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ====================================================
// ESCENA GLOBAL COMPARTIDA (se crea UNA sola vez)
// ====================================================
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

export let canvas;
if (isBrowser) {
  canvas = document.getElementById("c");
  canvas.addEventListener("pointerdown", () => canvas.focus());
} else {
  canvas = { addEventListener: () => {}, focus: () => {} };
}

export let renderer;
if (isBrowser) {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  } catch (e) {
    renderer = {
      domElement: { addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => {} },
      setPixelRatio: () => {},
      setSize: () => {},
      setClearColor: () => {},
      render: (scene) => { scene.updateMatrixWorld(); }
    };
  }
} else {
  renderer = {
    domElement: { addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => {} },
    setPixelRatio: () => {},
    setSize: () => {},
    setClearColor: () => {},
    render: (scene) => { scene.updateMatrixWorld(); }
  };
}

export const scene = new THREE.Scene();
scene.background = new THREE.Color("#0a0a0a");

export const camera = new THREE.PerspectiveCamera(60, 2, 0.1, 20000);
camera.position.set(0, 150, 350);

export let controls;
if (isBrowser && renderer instanceof THREE.WebGLRenderer) {
  try {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 100, 0);
  } catch (e) {
    controls = { enabled: true, autoRotate: false, target: new THREE.Vector3(), update: () => {} };
  }
} else {
  controls = { enabled: true, autoRotate: false, target: new THREE.Vector3(), update: () => {} };
}

scene.add(new THREE.AmbientLight(0xffffff, 0.25));
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(3, 5, 2);
scene.add(light);

THREE.Cache.enabled = true;

// --- Configuración global (afecta a todos los sandboxes) ---
let gridHelper = null;
let floorMesh = null;
let boxGroup = null;
export let globalPause = false;

export function setGlobalPause(paused) {
  globalPause = paused;
}

export function setGrid(size = 400, div = 10) {
  if (gridHelper) {
    scene.remove(gridHelper);
    gridHelper.geometry.dispose();
    gridHelper.material.dispose();
  }
  gridHelper = new THREE.GridHelper(size, div);
  scene.add(gridHelper);
}

export function setFloor(color = "#1a1a24", size = 1000) {
  if (color === false) {
    if (floorMesh) {
      scene.remove(floorMesh);
      floorMesh.geometry.dispose();
      floorMesh.material.dispose();
      floorMesh = null;
    }
    return;
  }
  if (floorMesh) {
    scene.remove(floorMesh);
    floorMesh.geometry.dispose();
    floorMesh.material.dispose();
  }
  let finiteSize = Number(size);
  if (isNaN(finiteSize) || finiteSize <= 0) {
    finiteSize = 1000;
  } else {
    finiteSize = Math.max(1, Math.min(10000, finiteSize));
  }
  const validColor = color;
  let material;
  try {
    material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(validColor),
      side: THREE.DoubleSide
    });
  } catch (e) {
    console.warn("Invalid color provided to floor(), using default.", e);
    material = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#1a1a24"),
      side: THREE.DoubleSide
    });
  }
  const geometry = new THREE.PlaneGeometry(finiteSize, finiteSize);
  floorMesh = new THREE.Mesh(geometry, material);
  floorMesh.rotation.x = -Math.PI / 2;
  // position.y = -1 para evitar z-fighting con el grid en y=0
  floorMesh.position.y = -1;
  scene.add(floorMesh);
}

export function setBox(n, dist) {
  if (n === undefined) n = 3;
  if (dist === undefined) dist = 50;
  if (boxGroup) {
    scene.remove(boxGroup);
    boxGroup.traverse((child) => {
      if (child.isLineSegments) {
        child.geometry.dispose();
        child.material.dispose();
      }
    });
  }
  boxGroup = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const size = 10 + i * dist;
    const geometry = new THREE.BoxGeometry(size, size, size);
    const edges = new THREE.EdgesGeometry(geometry);
    const material = new THREE.LineBasicMaterial({ color: 0xffffff });
    const box = new THREE.LineSegments(edges, material);
    boxGroup.add(box);
  }
  scene.add(boxGroup);
}

export function setCam(x = 0, y = 200, z = 450, lx = 0, ly = 120, lz = 0) {
  camera.position.set(x, y, z);
  controls.target.set(lx, ly, lz);
}

export function setBackground(color) {
  scene.background = new THREE.Color(color);
}

export function setRot(v) {
  if (v !== 0) {
    controls.autoRotate = true;
    controls.autoRotateSpeed = v * 20;
  } else {
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0;
  }
}

// Valores iniciales
setGrid(800, 20);

export const clock = new THREE.Clock();
