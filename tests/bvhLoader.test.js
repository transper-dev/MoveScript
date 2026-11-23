import test from 'node:test';
import assert from 'node:assert';
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js';
import { loadBvhContent } from '../src/engine/bvh.js';

test('BVHLoader can parse string content directly', () => {
    const loader = new BVHLoader();
    // Ejemplo mínimo de un archivo BVH
    const bvhContent = `HIERARCHY
ROOT Hips
{
  OFFSET 0.00 0.00 0.00
  CHANNELS 3 Zposition Yposition Xposition
  JOINT Chest
  {
    OFFSET 0.00 0.00 0.00
    CHANNELS 3 Zrotation Yrotation Xrotation
    End Site
    {
      OFFSET 0.00 0.00 0.00
    }
  }
}
MOTION
Frames: 1
Frame Time: 0.03333333
0.00 0.00 0.00 0.00 0.00 0.00`;

    const result = loader.parse(bvhContent);
    assert.ok(result.skeleton, 'Skeleton should be parsed');
    assert.ok(result.clip, 'Clip should be parsed');
});

test('loadBvhContent falls back to global asset when local BVH is missing', async () => {
    const localError = Object.assign(new Error('File not found: deep_breath.bvh'), { code: 'ENOENT' });
    const globalContent = 'global bvh content';
    const calls = [];

    const content = await loadBvhContent('deep_breath', {
        hasLocalBvh: true,
        readLocal: async filename => {
            calls.push(['local', filename]);
            throw localError;
        },
        fetchGlobal: async url => {
            calls.push(['global', url]);
            return globalContent;
        }
    });

    assert.strictEqual(content, globalContent);
    assert.deepStrictEqual(calls, [
        ['local', 'deep_breath.bvh'],
        ['global', './assets/bvh/deep_breath.bvh']
    ]);
});

test('loadBvhContent falls back when the IPC read returns null for a missing local BVH', async () => {
    const content = await loadBvhContent('deep_breath', {
        hasLocalBvh: true,
        readLocal: async () => null,
        fetchGlobal: async () => 'global bvh content'
    });

    assert.strictEqual(content, 'global bvh content');
});

test('loadBvhContent propagates local read errors other than missing files', async () => {
    const localError = Object.assign(new Error('Permission denied'), { code: 'EACCES' });

    await assert.rejects(
        loadBvhContent('urki', {
            hasLocalBvh: true,
            readLocal: async () => { throw localError; },
            fetchGlobal: async () => 'should not load'
        }),
        error => error === localError
    );
});
