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

export function parseXrCode(payload) {
  const code = typeof payload === 'string' ? payload : payload?.code;
  if (typeof code !== 'string') return { ...DEFAULT_XR_STATE };

  const positionMatch = code.match(/\.pos\(\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\)/i);
  return {
    file: firstMatch(code, /\[\s*bvh\(\s*["']([^"']+)["']\s*\)/i, DEFAULT_XR_STATE.file),
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
