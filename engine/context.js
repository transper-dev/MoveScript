/**
 * Context - Gestión de contextos de sandbox
 * Cada sandbox tiene su propio contexto con rigs, trails, timers y parámetros
 */

import * as THREE from "three";
import { scene, globalPause } from './scene.js';
import {
  DEFAULT_SANDBOX,
  SANDBOX_SPACING,
  defaultParams,
  disposeRig,
  deselect,
  getSelectedRig,
  frameCount
} from './utils.js';

// ====================================================
// CONTEXTO POR SANDBOX
// ====================================================
export const contexts = new Map();

export class SandboxContext {
  constructor(id, order, buildApi) {
    this.id = id;
    this.order = order;
    this.rigs = [];
    this.trails = [];
    this.bvhCounter = 0;
    this.runId = 0;
    this.params = defaultParams();
    this.timers = new Set();
    this.disposed = false;
    this.paused = false; // pausa local de este sandbox (se suma a la pausa global)
    this.api = buildApi(this);
  }

  // Posición X por defecto cuando el usuario no escribe .pos()/.x()
  get defaultX() { return this.order * SANDBOX_SPACING; }

  // Timers ligados al runId: si hay un nuevo Run/clear/destroy, no se ejecutan
  later(fn, ms = 0) {
    const run = this.runId;
    const id = setTimeout(() => {
      this.timers.delete(id);
      if (run === this.runId && !this.disposed) fn();
    }, ms);
    this.timers.add(id);
    return id;
  }

  every(fn, ms) {
    const run = this.runId;
    const id = setInterval(() => {
      if (run !== this.runId || this.disposed) {
        clearInterval(id);
        this.timers.delete(id);
        return;
      }
      fn(id);
    }, ms);
    this.timers.add(id);
    return id;
  }

  cancel(id) {
    clearTimeout(id);
    clearInterval(id);
    this.timers.delete(id);
  }

  // Limpia SOLO los objetos de este sandbox
  clear() {
    this.runId++;
    this.bvhCounter = 0;
    for (const t of this.timers) {
      clearTimeout(t);
      clearInterval(t);
    }
    this.timers.clear();

    const selectedRig = getSelectedRig();
    if (selectedRig && selectedRig.ctx === this) deselect();

    for (const r of this.rigs) disposeRig(r);
    for (const t of this.trails) {
      scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mesh.material.dispose();
    }
    this.rigs.length = 0;
    this.trails.length = 0;
    this.params = defaultParams();
    this.paused = false; // un nuevo Run reanuda este sandbox
  }

  destroy() {
    this.clear();
    this.disposed = true;
    contexts.delete(this.id);
  }

  tick(dt) {
    const paused = globalPause || this.paused;

    for (const r of this.rigs) {
      // Aplica autoScale si fue calculado al crear el rig
      if (r.group) r.group.scale.setScalar((r.autoScale || 1) * (r.opts.scale ?? this.params.globalScale));

      const trailLen = r.opts.trail ?? this.params.trail;
      const delayTime = r.opts.delay ?? this.params.delay;
      const isVisible = r.handle._useDummy ? r.root.visible : (r.helper && r.helper.visible);

      if (!paused && trailLen > 0 && frameCount % 6 === 0 && isVisible && r.timeAlive >= delayTime) {
        const snapGeom = r.helper.geometry.clone();
        snapGeom.applyMatrix4(r.helper.matrixWorld);
        const snapMat = r.helper.material.clone();
        snapMat.transparent = true;
        snapMat.opacity = 0.6;
        const snapLine = new THREE.LineSegments(snapGeom, snapMat);
        scene.add(snapLine);
        this.trails.push({ mesh: snapLine, life: 0.6, decay: 0.6 / trailLen });
      }
    }

    for (let i = this.trails.length - 1; i >= 0; i--) {
      const t = this.trails[i];
      t.life -= t.decay;
      t.mesh.material.opacity = t.life;
      if (t.life <= 0) {
        scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
        this.trails.splice(i, 1);
      }
    }

    if (paused) return;

    for (const r of this.rigs) {
      const delayTime = r.opts?.delay ?? this.params.delay;
      const isVisible = r.handle._useDummy ? r.root.visible : (r.helper && r.helper.visible);

      if (r.handle._isChained && r.handle !== r.handle._chainHead && !isVisible && r.timeAlive === 0) continue;

      const tiempoAnterior = r.timeAlive;
      r.timeAlive += dt;
      if (r.timeAlive < delayTime) continue;

      let tiempoActivo = dt;
      if (tiempoAnterior < delayTime) tiempoActivo = r.timeAlive - delayTime;

      const localSpeed = r.opts?.speed ?? 1.0;
      const isReversed = r.opts?.reverse ?? this.params.reverse;
      r.mixer.timeScale = this.params.speed * localSpeed * (isReversed ? -1 : 1);

      if (isReversed && r.action && r.clip && !r.handle._isChained) {
        if (r.action.time <= 0.0001) r.action.time = r.clip.duration;
      }

      r.mixer.update(tiempoActivo);
    }
  }
}

export function getCtx(id = DEFAULT_SANDBOX, buildApi) {
  let ctx = contexts.get(id);
  if (!ctx) {
    const used = new Set([...contexts.values()].map(c => c.order));
    let order = 0;
    while (used.has(order)) order++; // menor hueco libre
    ctx = new SandboxContext(id, order, buildApi);
    contexts.set(id, ctx);
  }
  return ctx;
}

export const allRigs = () => [...contexts.values()].flatMap(c => c.rigs);
