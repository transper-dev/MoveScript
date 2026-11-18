let defaultFactory = null;

export function setEditorFactory(fn) {
  defaultFactory = fn;
}

export function createEditor(textarea, opts) {
  if (defaultFactory) {
    if (typeof defaultFactory.fromTextArea === 'function') {
      return defaultFactory.fromTextArea(textarea, opts);
    }
    if (typeof defaultFactory === 'function') {
      return defaultFactory(textarea, opts);
    }
  }
  if (typeof window !== 'undefined' && window.CodeMirror?.fromTextArea) {
    return window.CodeMirror.fromTextArea(textarea, opts);
  }
  if (typeof globalThis !== 'undefined' && globalThis.CodeMirror?.fromTextArea) {
    return globalThis.CodeMirror.fromTextArea(textarea, opts);
  }
  throw new Error('No Editor Factory registered and CodeMirror not available');
}
