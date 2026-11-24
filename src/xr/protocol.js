import * as THREE from 'three';

const DEFAULT_XR_STATE = {
  file: 'dummy',
  color: null,
  color2: null,
  scale: 1,
  speed: 1,
  reverse: false,
  position: [0, 0, 0],
  rotationY: 0,
  dummy: false
};

const XR_POSITION_LIMIT = 100;
const XR_SCALE_LIMIT = 10;
const XR_SPEED_LIMIT = 10;
const XR_ROTATION_LIMIT = Math.PI * 2;

function firstMatch(code, pattern, fallback = null) {
  return code.match(pattern)?.[1] ?? fallback;
}

function clampFinite(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(Math.max(number, min), max) : fallback;
}

function numberMatch(code, pattern, fallback, min, max) {
  return clampFinite(firstMatch(code, pattern, fallback), min, max, fallback);
}

export function getXrLineColors(color, color2) {
  return [color || '#00ffcc', color2 || color || '#00ffcc'];
}

export function getXrBoneBounds(bones) {
  const points = (bones || []).filter(bone => bone?.isBone).map(bone => {
    const target = new THREE.Vector3();
    return bone.getWorldPosition(target) || target;
  });
  const validPoints = points.filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.y));
  if (validPoints.length === 0) return { minY: 0, height: 1.7, centerX: 0 };
  const minY = Math.min(...validPoints.map(point => point.y));
  const maxY = Math.max(...validPoints.map(point => point.y));
  return { minY, height: Math.max(maxY - minY, 0.001), centerX: validPoints.reduce((sum, point) => sum + point.x, 0) / validPoints.length };
}

export function getXrTransform(bounds, state) {
  const minY = Number.isFinite(bounds?.minY) ? bounds.minY : 0;
  const height = Number.isFinite(bounds?.height) && bounds.height > 0 ? bounds.height : 1.7;
  const centerX = Number.isFinite(bounds?.centerX) ? bounds.centerX : 0;
  const scale = clampFinite((1.7 / height) * (state?.scale ?? 1), 0.01, 10, 1);
  const position = Array.isArray(state?.position) ? state.position : [0, 0, 0];
  return {
    scale,
    position: [
      clampFinite(position[0] - centerX * scale, -100, 100, 0),
      clampFinite(position[1] - minY * scale, -100, 100, 0),
      clampFinite(-4 + position[2], -100, 100, -4)
    ]
  };
}

export function getXrRigsFromPayload(payload) {
  const code = typeof payload === 'string' ? payload : payload?.code;
  const sandboxId = typeof payload === 'object' && payload !== null ? (payload.sandboxId || 'default') : 'default';
  const order = typeof payload === 'object' && payload !== null && Number.isInteger(payload.order) ? payload.order : 0;
  if (typeof code !== 'string') return [{ ...parseXrCode(code), sandboxId, order }];
  const blocks = code.split(';').map(part => part.trim()).filter(Boolean);
  if (blocks.length <= 1 && !/\bCHAIN\b/i.test(code)) {
    return [{ ...parseXrCode(code), sandboxId, order }];
  }
  return blocks.map((block, i) => ({ ...parseXrCode(block), sandboxId: `${sandboxId}_${i}`, order: order + i }));
}

export function parseXrCode(payload) {
  const code = typeof payload === 'string' ? payload : payload?.code;
  const sandboxId = typeof payload === 'object' && payload !== null ? (payload.sandboxId || 'default') : 'default';
  const order = typeof payload === 'object' && payload !== null && Number.isInteger(payload.order) ? payload.order : 0;
  if (typeof code !== 'string') return { ...DEFAULT_XR_STATE, sandboxId, order };

  const positionMatch = code.match(/\.pos\(\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\)/i);
  return {
    sandboxId,
    order,
    file: firstMatch(code, /(?:\[\s*bvh|\.bvh)\(\s*["']([^"']+)["']\s*\)/i, DEFAULT_XR_STATE.file),
    color: firstMatch(code, /\.color\(\s*["']([^"']+)["']/i),
    color2: firstMatch(code, /\.color\(\s*["'][^"']+["']\s*,\s*["']([^"']+)["']/i),
    scale: numberMatch(code, /\.scale\(\s*([-+]?\d*\.?\d+)\s*\)/i, DEFAULT_XR_STATE.scale, 0.01, XR_SCALE_LIMIT),
    speed: numberMatch(code, /\.speed\(\s*([-+]?\d*\.?\d+)\s*\)/i, DEFAULT_XR_STATE.speed, -XR_SPEED_LIMIT, XR_SPEED_LIMIT),
    reverse: /\.reverse\(\s*(?:true\s*)?\)/i.test(code),
    position: positionMatch
      ? positionMatch.slice(1).map(value => clampFinite(value, -XR_POSITION_LIMIT, XR_POSITION_LIMIT, 0))
      : [...DEFAULT_XR_STATE.position],
    rotationY: numberMatch(code, /\.rotY\(\s*([-+]?\d*\.?\d+)\s*\)/i, DEFAULT_XR_STATE.rotationY, -XR_ROTATION_LIMIT, XR_ROTATION_LIMIT),
    dummy: /\.dummy\(\s*(?:true\s*)?\)/i.test(code)
  };
}
