const DEFAULT_XR_STATE = {
  file: 'dummy',
  color: null,
  color2: null,
  scale: 1,
  speed: 1,
  reverse: false
};

function firstMatch(code, pattern, fallback = null) {
  return code.match(pattern)?.[1] ?? fallback;
}

export function parseXrCode(payload) {
  const code = typeof payload === 'string' ? payload : payload?.code;
  if (typeof code !== 'string') return { ...DEFAULT_XR_STATE };

  return {
    file: firstMatch(code, /\[\s*bvh\(\s*["']([^"']+)["']\s*\)/i, DEFAULT_XR_STATE.file),
    color: firstMatch(code, /\.color\(\s*["']([^"']+)["']/i),
    color2: firstMatch(code, /\.color\(\s*["'][^"']+["']\s*,\s*["']([^"']+)["']/i),
    scale: Number(firstMatch(code, /\.scale\(\s*([-+]?\d*\.?\d+)\s*\)/i, DEFAULT_XR_STATE.scale)),
    speed: Number(firstMatch(code, /\.speed\(\s*([-+]?\d*\.?\d+)\s*\)/i, DEFAULT_XR_STATE.speed)),
    reverse: /\.reverse\(\s*(?:true\s*)?\)/i.test(code)
  };
}
