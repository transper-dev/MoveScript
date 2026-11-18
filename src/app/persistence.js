import { ls, LIST_KEY, codeKey } from '../ui/storage.js';

export function readLayout() {
  let o = null;
  try { o = JSON.parse(ls.get(LIST_KEY)); } catch (e) { return null; }
  if (!o) return null;
  if (Array.isArray(o.windows)) return o;
  if (Array.isArray(o.items)) {
    return {
      windows: o.items.map(it => ({
        left: it.left, top: it.top, width: it.width, height: it.height, minimized: it.minimized,
        tabs: [{ id: it.id, label: it.label }], active: it.id
      }))
    };
  }
  return null;
}

export function restoreInitial(createSandbox, createWindow, pendingRuns) {
  const layout = readLayout();
  let restored = 0;
  if (layout) {
    for (const w of layout.windows) {
      if (!w || !Array.isArray(w.tabs)) continue;
      let win = null;
      for (const t of w.tabs) {
        if (restored >= 8) break; // MAX_SANDBOXES
        if (!t || typeof t.id !== "string") continue; // state.sandboxes.has(t.id) is checked inside createSandbox
        const stored = ls.get(codeKey(t.id));
        if (stored === null) continue;
        const sb = createSandbox({ id: t.id, label: t.label, code: stored, hasStored: true });
        if (!sb) continue;
        if (!win) {
          win = createWindow({
            left: Math.max(8, Math.min(window.innerWidth - 120, Number(w.left) || 16)),
            top: Math.max(8, Math.min(window.innerHeight - 60, Number(w.top) || 16)),
            width: w.width || "", height: w.height || ""
          });
        }
        win.addTab(sb);
        sb.markSaved();
        pendingRuns.add(sb.id);
        restored++;
      }
      if (win) {
        const act = win.tabs.find(t => t.id === w.active) || win.tabs[0];
        win.selectTab(act);
        if (w.minimized) win.toggleMinimized();
      }
    }
  }
  return restored;
}
