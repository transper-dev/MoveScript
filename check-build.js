import { execSync } from 'node:child_process';
import fs from 'node:fs';

execSync('npx vite build --mode web --outDir dist-guard/web', { stdio: 'ignore' });
execSync('npx vite build --mode desktop --outDir dist-guard/desktop', { stdio: 'ignore' });

const terms = ['socket.io', 'electron', 'ipcRenderer', 'movescriptDesktop', 'pinggy'];
const results = { web: {}, desktop: {} };

function check(dir, target) {
  const files = fs.readdirSync(dir, { recursive: true });
  files.forEach(f => {
    const fullPath = dir + '/' + f;
    if (fs.statSync(fullPath).isFile() && (fullPath.endsWith('.js'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      terms.forEach(t => {
        if (content.includes(t)) results[target][t] = (results[target][t] || 0) + 1;
      });
    }
  });
}

check('dist-guard/web', 'web');
check('dist-guard/desktop', 'desktop');
console.log('Results:', JSON.stringify(results, null, 2));
fs.rmSync('dist-guard', { recursive: true, force: true });
