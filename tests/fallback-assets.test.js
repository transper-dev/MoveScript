import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

test('Fallback animations exist as files in public/assets/bvh/', () => {
    const fallback = ["deep_breath", "surprise", "posing"];
    const bvhDir = path.join(process.cwd(), 'public', 'assets', 'bvh');

    for (const name of fallback) {
        const filePath = path.join(bvhDir, `${name}.bvh`);
        assert.ok(fs.existsSync(filePath), `Fallback animation file missing: ${filePath}`);
    }
});
