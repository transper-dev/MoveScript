import test from 'node:test';
import assert from 'node:assert';
import './setup.js';
import { initHelpSidebar } from '../src/ui/helpSidebar.js';

test('HelpSidebar UI - toggle and insert commands', () => {
  document.body.innerHTML = `
    <div id="help-sidebar">
      <div id="help-toggle">?</div>
      <div class="help-content">
        <div class="help-item" data-insert='[bvh("walk")]'>Walk</div>
        <div class="help-item" data-insert='.joints(2)'>Joints</div>
      </div>
    </div>
    <iframe id="preview"></iframe>
  `;

  let editorValue = '[bvh("idle")]';
  global.window.editor = {
    getValue: () => editorValue,
    setValue: (v) => { editorValue = v; },
    lineCount: () => editorValue.split('\n').length,
    getLine: (i) => editorValue.split('\n')[i] || '',
    setCursor: (c) => {},
    replaceSelection: (t) => { editorValue += t; },
    focus: () => {}
  };
  global.window.runActiveSandbox = () => {};

  initHelpSidebar();

  const toggle = document.getElementById('help-toggle');
  const sidebar = document.getElementById('help-sidebar');

  toggle.click();
  assert.strictEqual(sidebar.classList.contains('abierto'), true);
  assert.strictEqual(toggle.textContent, 'X');

  // Test insertion starting with [
  const walkItem = document.querySelector('[data-insert*="bvh"]');
  walkItem.click();
  assert.ok(editorValue.includes('[bvh("walk")]'));

  // Test insertion without [
  const jointsItem = document.querySelector('[data-insert*="joints"]');
  jointsItem.click();
  assert.ok(editorValue.includes('.joints(2)'));
});
