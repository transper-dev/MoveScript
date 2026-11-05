/**
 * API - Construcción y ejecución de la API del usuario
 * buildApi() construye la API expuesta al código del usuario
 * executeInSandbox() ejecuta código de usuario con la API inyectada
 */

import { setGlobalPause, setGrid, setCam, setBackground, setRot } from './scene.js';
import { createBvh, duplicateHandle, makeChain, RigNode } from './bvh.js';

/**
 * Construye el objeto API que se expone al código del usuario
 * Cada sandbox tiene su propia instancia de API
 */
export function buildApi(ctx) {
  const api = {
    // Métodos por sandbox
    clear() { ctx.clear(); return api; },
    bvh: (f) => createBvh(ctx, f),
    duplicate: (h) => duplicateHandle(ctx, h),
    speed(v) { ctx.params.speed = v; return api; },
    skeleton(v = true) { ctx.params.showSkeleton = v; return api; },
    scale(v) { ctx.params.globalScale = v; return api; },
    reverse(v = true) { ctx.params.reverse = v; return api; },
    color(c1, c2) { ctx.params.color = c1; ctx.params.color2 = c2; return api; },
    trail(v) { ctx.params.trail = v; return api; },
    delay(s) { ctx.params.delay = s; return api; },

    // Métodos globales (afectan a toda la escena)
    pause(v = true) { setGlobalPause(v); return api; },
    grid(size, div) { setGrid(size, div); return api; },
    cam(...a) { setCam(...a); return api; },
    background(c) { setBackground(c); return api; },
    bg(c) { setBackground(c); return api; },
    rot(v) { setRot(v); return api; },

    // Sintaxis declarativa
    $B: () => new RigNode(),
    CHAIN: makeChain(ctx)
  };
  return api;
}

const API_NAMES = ["clear", "bvh", "duplicate", "speed", "skeleton", "scale", "reverse", "color", "trail", "delay", "pause", "grid", "cam", "background", "bg", "rot", "$B", "CHAIN"];

/**
 * Ejecuta código de usuario en un sandbox con la API inyectada como parámetros
 * Usa new Function para evitar contaminar el scope global
 */
export function executeInSandbox(ctx, code) {
  if (/\b(window|document|eval|fetch|XMLHttpRequest|localStorage|sessionStorage)\b/.test(code)) {
    throw new Error("SecurityError: Uso de APIs globales prohibidas en el sandbox.");
  }
  const fn = new Function(...API_NAMES, code);
  fn(...API_NAMES.map(n => ctx.api[n]));
}
