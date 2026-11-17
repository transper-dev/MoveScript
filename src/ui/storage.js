export const LEGACY_KEY = "movescript_saved_code";   // esquema antiguo (un solo editor)
export const LIST_KEY = "movescript_sandboxes";      // { windows: [{ left, top, width, height, minimized, tabs: [{id,label}], active }] }
export const codeKey = (id) => `movescript_sandbox_${id}`;

// localStorage con protección (modo privado, cuota, etc.)
export const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { console.warn("No se pudo guardar", e); } },
  remove(k) { try { localStorage.removeItem(k); } catch (e) { /* nada */ } }
};
