import test from 'node:test';
import assert from 'node:assert';
import { appendBvhToChain } from '../src/dsl/insertBvh.js';

test('InsertBvh - error más de 1 bloque (verificación)', () => {
  // Verificamos que el mensaje coincide exactamente con el requerido en el test e2e
  const code = '[bvh("a")][bvh("b")]';
  const result = appendBvhToChain(code, 'walk');
  assert.strictEqual(result.error, 'Solo se permite una secuencia continua por sandbox. Une los bloques con \'>\'');
});
