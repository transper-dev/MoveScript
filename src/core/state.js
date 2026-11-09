
export const sandboxes = new Map();
export const windows = [];
export let activeSandbox = null;
export let zCounter = 1;

export function setActiveSandbox(sb) { activeSandbox = sb; }
export function incrementZCounter() { return ++zCounter; }
