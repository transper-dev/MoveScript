import test from 'node:test';
import assert from 'node:assert';
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js';

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
