import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

test('Build Guard - dist-guard bundles verification', () => {
  const distGuardWeb = path.resolve(process.cwd(), 'dist-guard/web');
  const distGuardDesktop = path.resolve(process.cwd(), 'dist-guard/desktop');

  try {
    execSync('npx vite build --mode web --outDir dist-guard/web', { stdio: 'ignore' });
    execSync('npx vite build --mode desktop --outDir dist-guard/desktop', { stdio: 'ignore' });

    assert.ok(fs.existsSync(distGuardWeb), 'dist-guard/web must exist');
    assert.ok(fs.existsSync(distGuardDesktop), 'dist-guard/desktop must exist');

    const forbiddenTerms = ['socket.io', 'electron', 'ipcRenderer', 'movescriptDesktop', 'pinggy'];

    function scanDir(dir, isDesktop = false) {
      let foundForbidden = false;
      let foundDesktopTerm = false;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const res = scanDir(fullPath, isDesktop);
          if (res.foundForbidden) foundForbidden = true;
          if (res.foundDesktopTerm) foundDesktopTerm = true;
        } else if (entry.isFile()) {
          if (!isDesktop) {
            assert.strictEqual(entry.name.includes('desktop-'), false, `Desktop-specific file found in web: ${entry.name}`);
          }
          if (fullPath.endsWith('.js') || fullPath.endsWith('.html')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            for (const term of forbiddenTerms) {
              if (content.includes(term)) {
                if (isDesktop && term === 'movescriptDesktop') {
                  foundDesktopTerm = true;
                } else {
                  foundForbidden = true;
                  assert.strictEqual(true, false, `Forbidden term "${term}" found in ${path.relative(process.cwd(), fullPath)}`);
                }
              }
            }
          }
        }
      }
      return { foundForbidden, foundDesktopTerm };
    }

    const webResult = scanDir(distGuardWeb, false);
    assert.strictEqual(webResult.foundForbidden, false, 'Web bundle must not contain forbidden terms');

    const desktopResult = scanDir(distGuardDesktop, true);
    assert.strictEqual(desktopResult.foundDesktopTerm, true, 'Desktop bundle must contain movescriptDesktop (positive control)');

  } finally {
    if (fs.existsSync(path.resolve(process.cwd(), 'dist-guard'))) {
      fs.rmSync(path.resolve(process.cwd(), 'dist-guard'), { recursive: true, force: true });
    }
  }
});
