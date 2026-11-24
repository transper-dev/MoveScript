import test from 'node:test';
import assert from 'node:assert/strict';
import { createDesktopServices, createOscMessages, normalizeVrData } from '../electron/desktopServices.js';

test('normalizeVrData accepts finite controller coordinates only', () => {
  assert.deepEqual(normalizeVrData({ c1: [1, 80, 3], c2: [4, 150, 6] }), {
    c1: [1, 80, 3],
    c2: [4, 150, 6]
  });
});

test('normalizeVrData drops malformed or unbounded controller data', () => {
  assert.deepEqual(normalizeVrData({ c1: ['1', 80], c2: [0, Infinity, 0], extra: true }), {
    c1: null,
    c2: null
  });
});

test('createOscMessages maps both controller Y values to bounded OSC values', () => {
  assert.deepEqual(createOscMessages({ c1: [0, 60, 0], c2: [0, 150, 0] }), [
    ['/vr/left_y', 0],
    ['/vr/right_y', 5000]
  ]);
});

test('createDesktopServices serves packaged assets instead of the local BVH directory', () => {
  const services = createDesktopServices({
    staticDir: 'packaged-root',
    onTunnelStart: () => null
  });

  assert.equal(services.assetMount.route, '/assets');
  assert.match(services.assetMount.directory, /packaged-root[\\/]assets$/);

  services.stop();
});

test('createDesktopServices broadcasts editor code to connected XR clients', () => {
  const services = createDesktopServices({
    staticDir: 'packaged-root',
    onTunnelStart: () => null
  });

  assert.equal(services.broadcastCode('[bvh("walk")]'), true);
  assert.equal(services.getLastCode(), '[bvh("walk")]');
  const replay = [];
  assert.equal(services.sendLastCode({ emit: (...args) => replay.push(args) }), true);
  assert.deepEqual(replay, [['execute_code', '[bvh("walk")]']]);
  assert.equal(services.broadcastCode({ code: '[bvh("walk")]' }), true);
  assert.deepEqual(services.getLastCode(), { code: '[bvh("walk")]' });
  assert.equal(services.broadcastCode('x'.repeat(256 * 1024 + 1)), false);

  services.stop();
});

test('createDesktopServices recognizes XR clients explicitly', () => {
  const statuses = [];
  const services = createDesktopServices({
    staticDir: 'packaged-root',
    onTunnelStart: () => null,
    onVrStatus: status => statuses.push(status)
  });

  assert.equal(services.isVrClient({ handshake: { headers: { 'user-agent': 'Mozilla' } } }), false);
  assert.equal(services.isVrClient({ handshake: { headers: { 'user-agent': 'Quest Browser' } } }), true);
  assert.deepEqual(statuses, []);

  services.stop();
});
