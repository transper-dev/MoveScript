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

test('HelpSidebar UI - missing elements and empty editor branches', () => {
  document.body.innerHTML = ``;
  assert.doesNotThrow(() => initHelpSidebar());

  document.body.innerHTML = `
    <div id="help-sidebar">
      <div id="help-toggle">?</div>
      <div class="help-content">
        <div class="help-item" data-insert='[bvh("dance")]'>Dance</div>
      </div>
    </div>
    <iframe id="preview"></iframe>
  `;

  let editorVal = '';
  global.window.editor = {
    getValue: () => editorVal,
    setValue: (v) => { editorVal = v; },
    lineCount: () => 1,
    getLine: () => editorVal,
    setCursor: () => {},
    replaceSelection: (t) => { editorVal += t; },
    focus: () => {}
  };

  initHelpSidebar();
  const item = document.querySelector('.help-item');
  item.click();
  assert.strictEqual(editorVal, '[bvh("dance")]');
});
