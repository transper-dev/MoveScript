import test from 'node:test';
import assert from 'node:assert';
import { appendBvhToChain } from '../src/dsl/insertBvh.js';

test('InsertBvh - vacío', () => {
  const result = appendBvhToChain('', 'walk');
  assert.strictEqual(result.code, '[bvh("walk")]');
  assert.strictEqual(result.cursorIndex, '[bvh("walk")]'.length);
});

test('InsertBvh - bloque simple', () => {
  const result = appendBvhToChain('[bvh("idle")]', 'walk');
  assert.strictEqual(result.code, '[bvh("idle")]\n>[bvh("walk")]');
});

test('InsertBvh - bloque con > previo', () => {
  const result = appendBvhToChain('[bvh("a")]>', 'walk');
  assert.strictEqual(result.code, '[bvh("a")]>\n[bvh("walk")]');
});

test('InsertBvh - bloque con ; final', () => {
  const result = appendBvhToChain('[bvh("idle")];', 'walk');
  assert.strictEqual(result.code, '[bvh("idle")]\n>[bvh("walk")];');
});

test('InsertBvh - cadena con cam', () => {
  const code = '[bvh("a")]>[color("red")]; cam(0,1,1)';
  const result = appendBvhToChain(code, 'walk');
  assert.strictEqual(result.code, '[bvh("a")]>[color("red")]\n>[bvh("walk")]; cam(0,1,1)');
});

test('InsertBvh - comentario de línea tras bloque', () => {
  const code = '[bvh("a")] // comentario';
  const result = appendBvhToChain(code, 'walk');
  assert.strictEqual(result.code, '[bvh("a")]\n>[bvh("walk")] // comentario');
});

test('InsertBvh - multilínea con un bloque', () => {
  const code = '// inicio\n[bvh("a")];\n// fin';
  const result = appendBvhToChain(code, 'walk');
  assert.strictEqual(result.code, '// inicio\n[bvh("a")]\n>[bvh("walk")];\n// fin');
});

test('InsertBvh - error mas de 1 bloque', () => {
  const code = '[bvh("a")][bvh("b")]';
  const result = appendBvhToChain(code, 'walk');
  assert.ok(result.error);
  assert.strictEqual(result.error, 'Solo se permite una secuencia continua por sandbox. Une los bloques con \'>\'');
});

test('InsertBvh - sin bloques con código', () => {
  const code = 'bg("#000");';
  const result = appendBvhToChain(code, 'walk');
  assert.strictEqual(result.code, 'bg("#000");\n[bvh("walk")]');
});

test('InsertBvh - nombre inválido', () => {
  const result = appendBvhToChain('', 'http://mal');
  assert.ok(result.error);
  assert.strictEqual(result.error, 'Nombre de animación inválido');
});
