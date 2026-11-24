import test from 'node:test';
import assert from 'node:assert/strict';
import { getCtx, SandboxContext } from '../src/engine/context.js';
import { buildApi, executeInSandbox } from '../src/engine/api.js';
import { getXrBoneBounds, getXrLineColors, getXrRigsFromPayload, getXrTransform, parseXrCode } from '../src/xr/protocol.js';

test('parseXrCode extracts the first animation and visual controls', () => {
  const result = parseXrCode('[bvh("walk").color("red", "blue").scale(2).speed(0.5).reverse()]');
  assert.equal(result.file, 'walk');
  assert.equal(result.color, 'red');
  assert.equal(result.color2, 'blue');
  assert.equal(result.scale, 2);
  assert.equal(result.speed, 0.5);
  assert.equal(result.reverse, true);
});

test('getXrLineColors preserves solid and gradient colors', () => {
  assert.deepEqual(getXrLineColors(null, null), ['#00ffcc', '#00ffcc']);
  assert.deepEqual(getXrLineColors('red', 'blue'), ['red', 'blue']);
});

test('getXrRigsFromPayload handles per-sandbox updates and preserves order spacing', () => {
  const rigs1 = getXrRigsFromPayload({ sandboxId: 's1', order: 0, code: '[bvh("walk")]' });
  const rigs2 = getXrRigsFromPayload({ sandboxId: 's2', order: 1, code: '[bvh("monster_walk")]' });
  assert.equal(rigs1[0].sandboxId, 's1');
  assert.equal(rigs1[0].order, 0);
  assert.equal(rigs2[0].sandboxId, 's2');
  assert.equal(rigs2[0].order, 1);
});

test('parseXrCode extracts metadata like sandboxId and order', () => {
  const state = parseXrCode({ type: 'execute', sandboxId: 's2', order: 1, code: '[bvh("walk")]' });
  assert.equal(state.sandboxId, 's2');
  assert.equal(state.order, 1);
  assert.equal(state.file, 'walk');
});

test('parseXrCode extracts modifiers from transpiled CHAIN payloads', () => {
  const result = parseXrCode('CHAIN($B().bvh("walk").color("red").scale(2).speed(0.5))');
  assert.equal(result.file, 'walk');
  assert.equal(result.color, 'red');
  assert.equal(result.scale, 2);
  assert.equal(result.speed, 0.5);
});

test('parseXrCode uses a safe dummy fallback for unsupported payloads', () => {
  const result = parseXrCode({ code: 'background("red")' });
  assert.equal(result.file, 'dummy');
  assert.equal(result.scale, 1);
});

test('parseXrCode supports position, rotation, dummy, and chained blocks', () => {
  const result = parseXrCode('[bvh("walk").pos(2, 3, -4).rotY(1.5).dummy()]>[bvh("next")]');
  assert.equal(result.file, 'walk');
  assert.deepEqual(result.position, [2, 3, -4]);
  assert.equal(result.rotationY, 1.5);
  assert.equal(result.dummy, true);
});

test('parseXrCode clamps non-finite and extreme numeric modifiers', () => {
  const state = parseXrCode('[bvh("walk").pos(999999999999999999999999, -999999999999999999999999, 2).scale(999999999999999999999999).speed(-999999999999999999999999).rotY(999999999999999999999999)]');

  assert.deepEqual(state.position, [100, -100, 2]);
  assert.equal(state.scale, 10);
  assert.equal(state.speed, -10);
  assert.equal(state.rotationY, Math.PI * 2);
  assert.ok(state.position.every(Number.isFinite));
});

test('parseXrCode falls back when modifiers contain non-finite values', () => {
  const state = parseXrCode('[bvh("walk").pos(NaN, Infinity, -Infinity).scale(NaN).speed(Infinity).rotY(NaN)]');

  assert.deepEqual(state.position, [0, 0, 0]);
  assert.equal(state.scale, 1);
  assert.equal(state.speed, 1);
  assert.equal(state.rotationY, 0);
});

test('getXrTransform uses finite defaults for empty BVH bounds', () => {
  assert.deepEqual(getXrTransform({ minY: Infinity, height: 0, centerX: 0 }, { position: [0, 0, 0], scale: 1 }), {
    scale: 1,
    position: [0, 0, -4]
  });
});

test('getXrBoneBounds measures bone world positions for BVH rigs', () => {
  const bones = [
    { isBone: true, getWorldPosition: target => target.set(0, 1, 0) },
    { isBone: true, getWorldPosition: target => target.set(2, 3, 0) }
  ];

  assert.deepEqual(getXrBoneBounds(bones), {
    minY: 1,
    height: 2,
    centerX: 1
  });
});

test('executeInSandbox maintains multi-sandbox contexts and isolation', () => {
  const ctx1 = getCtx('xr-s1', buildApi);
  const ctx2 = getCtx('xr-s2', buildApi);
  assert.notStrictEqual(ctx1, ctx2);
  assert.strictEqual(ctx1.rigs.length, 0);
  assert.strictEqual(ctx2.rigs.length, 0);
});

test('getXrBoneBounds passes a THREE.Vector3-compatible target to bones', () => {
  const bones = [{
    isBone: true,
    getWorldPosition: target => {
      assert.equal(typeof target.setFromMatrixPosition, 'function');
      return target.set(0, 2, 0);
    }
  }];

  assert.deepEqual(getXrBoneBounds(bones), { minY: 2, height: 0.001, centerX: 0 });
});
