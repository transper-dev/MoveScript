import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import { setEditorFactory, createEditor } from '../src/ui/editorFactory.js';

test('EditorFactory - uses defaultFactory function', () => {
  let textareaPassed = null;
  let optsPassed = null;

  setEditorFactory((textarea, opts) => {
    textareaPassed = textarea;
    optsPassed = opts;
    return 'customEditor';
  });

  const el = {};
  const res = createEditor(el, { lineNumbers: true });
  assert.strictEqual(res, 'customEditor');
  assert.strictEqual(textareaPassed, el);
  assert.strictEqual(optsPassed.lineNumbers, true);
});

test('EditorFactory - uses defaultFactory.fromTextArea object', () => {
  let textareaPassed = null;
  let optsPassed = null;

  setEditorFactory({
    fromTextArea: (textarea, opts) => {
      textareaPassed = textarea;
      optsPassed = opts;
      return 'customEditor2';
    }
  });

  const el = {};
  const res = createEditor(el, { lineNumbers: false });
  assert.strictEqual(res, 'customEditor2');
  assert.strictEqual(textareaPassed, el);
  assert.strictEqual(optsPassed.lineNumbers, false);
});

test('EditorFactory - falls back to window.CodeMirror', () => {
  setEditorFactory(null);
  global.window = global.window || {};
  global.window.CodeMirror = {
    fromTextArea: (textarea, opts) => {
      return 'windowCM';
    }
  };

  const res = createEditor({}, {});
  assert.strictEqual(res, 'windowCM');
  delete global.window.CodeMirror;
});

test('EditorFactory - falls back to globalThis.CodeMirror', () => {
  setEditorFactory(null);
  globalThis.CodeMirror = {
    fromTextArea: (textarea, opts) => {
      return 'globalThisCM';
    }
  };

  const res = createEditor({}, {});
  assert.strictEqual(res, 'globalThisCM');
  delete globalThis.CodeMirror;
});

test('EditorFactory - throws error when nothing is registered', () => {
  setEditorFactory(null);
  assert.throws(() => {
    createEditor({}, {});
  }, /No Editor Factory registered/);
});
