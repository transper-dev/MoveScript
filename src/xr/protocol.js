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

function firstMatch(code, pattern, fallback = null) {
  return code.match(pattern)?.[1] ?? fallback;
}

function numberMatch(code, pattern, fallback) {
  const value = Number(firstMatch(code, pattern, fallback));
  return Number.isFinite(value) ? value : fallback;
}

export function parseXrCode(payload) {
  const code = typeof payload === 'string' ? payload : payload?.code;
  if (typeof code !== 'string') return { ...DEFAULT_XR_STATE };

  const positionMatch = code.match(/\.pos\(\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\)/i);
  return {
    file: firstMatch(code, /\[\s*bvh\(\s*["']([^"']+)["']\s*\)/i, DEFAULT_XR_STATE.file),
    color: firstMatch(code, /\.color\(\s*["']([^"']+)["']/i),
    color2: firstMatch(code, /\.color\(\s*["'][^"']+["']\s*,\s*["']([^"']+)["']/i),
    scale: numberMatch(code, /\.scale\(\s*([-+]?\d*\.?\d+)\s*\)/i, DEFAULT_XR_STATE.scale),
    speed: numberMatch(code, /\.speed\(\s*([-+]?\d*\.?\d+)\s*\)/i, DEFAULT_XR_STATE.speed),
    reverse: /\.reverse\(\s*(?:true\s*)?\)/i.test(code),
    position: positionMatch
      ? positionMatch.slice(1).map(Number)
      : [...DEFAULT_XR_STATE.position],
    rotationY: numberMatch(code, /\.rotY\(\s*([-+]?\d*\.?\d+)\s*\)/i, DEFAULT_XR_STATE.rotationY),
    dummy: /\.dummy\(\s*(?:true\s*)?\)/i.test(code)
  };
}
