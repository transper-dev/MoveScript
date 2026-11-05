import {
  windows,
  createWindow,
  incrementZCounter,
  createSandbox,
  runSandbox,
  writeLayout,
  scheduleLayoutSave
} from '../main.js';

export class SandboxWindow {
  constructor({ left = 16, top = 16, width = "", height = "" } = {}) {
    this.tabs = [];
    this.activeSb = null;
    this.prevSize = null;

    this.el = document.createElement("div");
    this.el.className = "sandbox";
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
    if (width) this.el.style.width = width;
    if (height) this.el.style.height = height;
    this.el.style.zIndex = incrementZCounter();
    this.el.innerHTML = `
      <div class="sb-bar">
        <div class="sb-tabs"></div>
        <button class="sb-btn sb-icon sb-addtab" title="Nueva pestaña"><i class="fas fa-plus"></i></button>
        <div class="sb-actions">
          <button class="sb-btn sb-icon sb-run" title="Ejecutar (Ctrl+Enter)"><i class="fas fa-play"></i></button>
          <button class="sb-btn sb-icon sb-pause" title="Pausar este sandbox"><i class="fas fa-pause"></i></button>
          <button class="sb-btn sb-icon sb-save" title="Guardar (Ctrl+S)"><i class="fas fa-save"></i></button>
          <button class="sb-btn sb-icon sb-toggle" title="Ocultar (Esc)"><i class="fas fa-minus"></i></button>
        </div>
      </div>
      <div class="sb-body"></div>
      <div class="sb-resize"></div>`;

    this.barEl = this.el.querySelector(".sb-bar");
    this.tabsEl = this.el.querySelector(".sb-tabs");
    this.bodyEl = this.el.querySelector(".sb-body");
    this.addBtn = this.el.querySelector(".sb-addtab");
    this.runBtn = this.el.querySelector(".sb-run");
    this.pauseBtn = this.el.querySelector(".sb-pause");
    this.saveBtn = this.el.querySelector(".sb-save");
    this.toggleBtn = this.el.querySelector(".sb-toggle");
    this.resizeHandle = this.el.querySelector(".sb-resize");

    this.el.addEventListener("pointerdown", () => { if (this.activeSb) this.activeSb.activate(); }, true);
    this.addBtn.addEventListener("click", () => {
      const sb = createSandbox();
      if (!sb) return;
      this.addTab(sb);
      sb.activate();
      sb.cm.focus();
      scheduleLayoutSave();
    });
    this.runBtn.addEventListener("click", () => { if (this.activeSb) runSandbox(this.activeSb); });
    this.pauseBtn.addEventListener("click", () => { if (this.activeSb) this.activeSb.togglePause(); });
    this.saveBtn.addEventListener("click", () => { if (this.activeSb) this.activeSb.toggleSave(); });
    this.toggleBtn.addEventListener("click", () => this.toggleMinimized());

    this._wireBarDrag();
    this._wireResize();
  }

  // ---------- pestañas ----------
  addTab(sb, index = this.tabs.length) {
    index = Math.max(0, Math.min(index, this.tabs.length));
    sb.win = this;
    this.tabs.splice(index, 0, sb);
    this.tabsEl.insertBefore(sb.tabEl, this.tabsEl.children[index] || null);
    sb.holder.style.display = "none";
    this.bodyEl.appendChild(sb.holder);
    this.selectTab(sb);
    sb.syncUI();
  }

  // Saca la pestaña de esta ventana (NO destruye el sandbox)
  detachTab(sb) {
    const i = this.tabs.indexOf(sb);
    if (i < 0) return;
    this.tabs.splice(i, 1);
    sb.tabEl.remove();
    sb.holder.remove();
    sb.win = null;
    if (this.activeSb === sb) {
      this.activeSb = null;
      const next = this.tabs[Math.min(i, this.tabs.length - 1)];
      if (next) this.selectTab(next);
    }
  }

  selectTab(sb) {
    this.activeSb = sb;
    for (const t of this.tabs) {
      const on = t === sb;
      t.tabEl.classList.toggle("active", on);
      t.holder.style.display = on ? "" : "none";
    }
    sb.cm.refresh();
    this.syncToolbar(sb);
    try { sb.tabEl.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e) { /* nada */ }
  }

  // Reordena arrastrando dentro de la misma barra
  reorderByX(sb, x) {
    const cur = this.tabs.indexOf(sb);
    let pos = this.tabs.length;
    for (let i = 0; i < this.tabs.length; i++) {
      const r = this.tabs[i].tabEl.getBoundingClientRect();
      if (x < r.left + r.width / 2) { pos = i; break; }
    }
    if (pos > cur) pos--;
    if (pos === cur) return;
    this.tabs.splice(cur, 1);
    this.tabs.splice(pos, 0, sb);
    this.tabs.forEach(t => this.tabsEl.appendChild(t.tabEl));
  }

  indexForX(x) {
    for (let i = 0; i < this.tabs.length; i++) {
      const r = this.tabs[i].tabEl.getBoundingClientRect();
      if (x < r.left + r.width / 2) return i;
    }
    return this.tabs.length;
  }

  hitBar(x, y) {
    const r = this.barEl.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }
  setDrop(on) { this.barEl.classList.toggle("drop-target", on); }

  // ---------- barra de acciones (actúa sobre la pestaña activa) ----------
  syncToolbar(sb = this.activeSb) {
    if (!sb || sb !== this.activeSb) return;
    this.saveBtn.classList.toggle("saved", sb.isSaved);
    this.saveBtn.classList.toggle("dirty", sb.dirty);
    this.saveBtn.title = sb.isSaved
      ? "Guardado: clic para quitar el guardado (Ctrl+S)"
      : (sb.dirty ? "Guardar cambios (Ctrl+S)" : "Guardar (Ctrl+S)");

    const icon = this.pauseBtn.querySelector("i");
    if (icon) icon.className = sb.paused ? "fas fa-play-circle" : "fas fa-pause";
    this.pauseBtn.classList.toggle("paused", sb.paused);
    this.pauseBtn.title = sb.paused ? "Reanudar este sandbox" : "Pausar este sandbox";
  }

  // ---------- minimizar ----------
  toggleMinimized() {
    if (this.el.classList.toggle("minimized")) {
      this.prevSize = { width: this.el.style.width || "", height: this.el.style.height || "" };
      this.el.style.height = this.barEl.offsetHeight + "px";
      this.toggleBtn.innerHTML = '<i class="fas fa-expand-alt"></i>';
      this.toggleBtn.title = "Mostrar (Esc)";
    } else {
      this.el.style.width = this.prevSize?.width || "";
      this.el.style.height = this.prevSize?.height || "";
      this.toggleBtn.innerHTML = '<i class="fas fa-minus"></i>';
      this.toggleBtn.title = "Ocultar (Esc)";
      if (this.activeSb) this.activeSb.cm.refresh();
    }
    scheduleLayoutSave();
  }

  sizeStrings() {
    if (this.el.classList.contains("minimized")) return this.prevSize || { width: "", height: "" };
    return { width: this.el.style.width, height: this.el.style.height };
  }

  // ---------- posición / tamaño ----------
  moveTo(x, y) {
    this.el.style.left = `${Math.max(8, Math.min(window.innerWidth - this.el.offsetWidth - 8, x))}px`;
    this.el.style.top = `${Math.max(8, Math.min(window.innerHeight - this.el.offsetHeight - 8, y))}px`;
  }

  _wireBarDrag() {
    let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
    this.barEl.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest(".sb-tab, button")) return;
      dragging = true; this.barEl.setPointerCapture(e.pointerId);
      const rect = this.el.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY; startLeft = rect.left; startTop = rect.top;
    });
    this.barEl.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      this.moveTo(startLeft + (e.clientX - startX), startTop + (e.clientY - startY));
    });
    const stop = () => { if (dragging) scheduleLayoutSave(); dragging = false; };
    this.barEl.addEventListener("pointerup", stop);
    this.barEl.addEventListener("pointercancel", stop);
  }

  _wireResize() {
    let resizing = false, startW = 0, startH = 0, startRX = 0, startRY = 0;
    this.resizeHandle.addEventListener("pointerdown", (e) => {
      resizing = true; this.resizeHandle.setPointerCapture(e.pointerId);
      startW = this.el.offsetWidth; startH = this.el.offsetHeight;
      startRX = e.clientX; startRY = e.clientY; e.preventDefault();
    });
    this.resizeHandle.addEventListener("pointermove", (e) => {
      if (!resizing) return;
      this.el.style.width = `${Math.max(420, Math.min(window.innerWidth - 16, startW + (e.clientX - startRX)))}px`;
      this.el.style.height = `${Math.max(220, Math.min(window.innerHeight - 16, startH + (e.clientY - startRY)))}px`;
    });
    const stop = () => { if (resizing) scheduleLayoutSave(); resizing = false; };
    this.resizeHandle.addEventListener("pointerup", stop);
    this.resizeHandle.addEventListener("pointercancel", stop);
  }

  // Solo se persisten las pestañas con código guardado
  getLayout() {
    const stored = this.tabs.filter(t => t.hasStored);
    if (stored.length === 0) return null;
    const size = this.sizeStrings();
    const active = this.activeSb && this.activeSb.hasStored ? this.activeSb : stored[0];
    return {
      left: parseInt(this.el.style.left, 10) || 0,
      top: parseInt(this.el.style.top, 10) || 0,
      width: size.width || "",
      height: size.height || "",
      minimized: this.el.classList.contains("minimized"),
      tabs: stored.map(t => ({ id: t.id, label: t.label })),
      active: active.id
    };
  }

  destroy() {
    const i = windows.indexOf(this);
    if (i >= 0) windows.splice(i, 1);
    this.el.remove();
  }
}

// ====================================================
// ARRASTRE DE PESTAÑAS (reordenar / sacar a nueva ventana / apilar en otra)
// ====================================================
export function startTabGesture(e, sb) {
  const startX = e.clientX, startY = e.clientY;
  let mode = "pending";   // pending -> reorder (varias pestañas) | move (ventana de una pestaña)
  let moving = null, offX = 0, offY = 0, dropTarget = null, lastX = startX;

  document.body.classList.add("dragging"); // el iframe deja de capturar el ratón

  const setDrop = (target) => {
    if (target === dropTarget) return;
    if (dropTarget) dropTarget.setDrop(false);
    dropTarget = target;
    if (dropTarget) dropTarget.setDrop(true);
  };

  const onMove = (ev) => {
    lastX = ev.clientX;

    if (mode === "pending") {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
      const w = sb.win;
      if (w.tabs.length > 1) {
        mode = "reorder";
      } else {
        mode = "move"; moving = w;
        const r = w.el.getBoundingClientRect();
        offX = startX - r.left; offY = startY - r.top;
        w.el.classList.add("ghost");
      }
    }

    if (mode === "reorder") {
      const w = sb.win;
      const strip = w.barEl.getBoundingClientRect();
      const outside = ev.clientY < strip.top - 28 || ev.clientY > strip.bottom + 28 ||
        ev.clientX < strip.left - 40 || ev.clientX > strip.right + 40;
      if (!outside) { w.reorderByX(sb, ev.clientX); return; }

      // Sacar la pestaña a una ventana nueva que sigue al puntero
      const size = w.sizeStrings();
      w.detachTab(sb);
      moving = createWindow({ left: ev.clientX - 60, top: ev.clientY - 18, width: size.width, height: size.height });
      moving.addTab(sb);
      moving.el.classList.add("ghost");
      sb.activate();
      offX = 60; offY = 18;
      mode = "move";
    }

    if (mode === "move") {
      moving.moveTo(ev.clientX - offX, ev.clientY - offY);
      const target = windows.find(w => w !== moving && w.hitBar(ev.clientX, ev.clientY)) || null;
      setDrop(target);
    }
  };

  const finish = (apply) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    document.body.classList.remove("dragging");

    if (mode === "move" && moving) {
      moving.el.classList.remove("ghost");
      const target = dropTarget;
      setDrop(null);
      if (apply && target && windows.includes(target) && moving.tabs.length === 1) {
        // Apilar: la pestaña pasa a la ventana destino y la ventana de origen desaparece
        const index = target.indexForX(lastX);
        moving.detachTab(sb);
        moving.destroy();
        target.addTab(sb, index);
        sb.activate();
      } else {
        sb.activate();
      }
    }
    writeLayout();
  };
  const onUp = () => finish(true);
  const onCancel = () => finish(false);

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
}
