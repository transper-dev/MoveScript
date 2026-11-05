/**
 * Utils - Utilidades compartidas del motor
 * Constantes, funciones helper, selección de rigs
 */

import * as THREE from "three";
import { scene } from './scene.js';
import { MessageTypes } from '../shared/protocol.js';

export const DEFAULT_SANDBOX = "default";
export const SANDBOX_SPACING = 150; // separación en X entre sandboxes sin .pos() explícito

/**
 * Envía un mensaje postMessage al parent window (main.js)
 */
export const send = (type, sandboxId, extra = {}) =>
  window.parent.postMessage({ type, sandboxId: sandboxId ?? null, ...extra }, window.location.origin);

/**
 * Parámetros por defecto para cada contexto
 */
export const defaultParams = () => ({
  speed: 1.0,
  showSkeleton: true,
  globalScale: 1.0,
  reverse: false,
  color: null,
  color2: null,
  trail: 0,
  delay: 0
});

// --- Selección (global: solo un rig seleccionado en toda la escena) ---
let selectedRig = null;
export const raycaster = new THREE.Raycaster();
export const mouse = new THREE.Vector2();
export const selectionBox = new THREE.BoxHelper(new THREE.Group(), 0xffff00);
selectionBox.visible = false;
scene.add(selectionBox);

export function getSelectedRig() {
  return selectedRig;
}

export function setSelectedRig(rig) {
  selectedRig = rig;
}

export function deselect(notify = true) {
  if (!selectedRig) return;
  const id = selectedRig.ctx.id;
  selectedRig = null;
  selectionBox.visible = false;
  if (notify) send(MessageTypes.RIG_DESELECTED, id);
}

/**
 * Libera los recursos de un rig (mixer, helper, group)
 */
export function disposeRig(r) {
  if (r.mixer) {
    r.mixer.stopAllAction();
    if (r.root) r.mixer.uncacheRoot(r.root);
  }
  if (r.helper) {
    scene.remove(r.helper);
    if (r.helper.geometry) r.helper.geometry.dispose();
    if (r.helper.material) r.helper.material.dispose();
  }
  if (r.group) {
    scene.remove(r.group);
    r.group.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      }
    });
  }
}

export let frameCount = 0;

export function incrementFrameCount() {
  frameCount++;
}
