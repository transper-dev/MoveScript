/**
 * Layout - Persistencia y gestión del layout de las ventanas de sandbox
 */

import { ls, LIST_KEY } from '../ui/storage.js';
import * as state from './state.js';

let layoutTimer = null;

export function writeLayout() {
  clearTimeout(layoutTimer);
  const wins = state.windows.map(w => w.getLayout()).filter(Boolean);
  if (wins.length === 0) ls.remove(LIST_KEY);
  else ls.set(LIST_KEY, JSON.stringify({ windows: wins }));
}

export function scheduleLayoutSave() {
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(writeLayout, 300);
}

if (typeof window !== 'undefined') {
  window.addEventListener("beforeunload", writeLayout);
}
