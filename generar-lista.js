import fs from 'node:fs';
import path from 'node:path';
const bvhDir = path.join(process.cwd(), 'public', 'assets', 'bvh');
const files = fs.readdirSync(bvhDir);
const animaciones = files
  .filter(f => f.endsWith('.bvh') && fs.statSync(path.join(bvhDir, f)).isFile())
  .map(f => f.replace('.bvh', ''));
fs.writeFileSync(path.join(process.cwd(), 'public', 'assets', 'lista.json'), JSON.stringify(animaciones, null, 2));
console.log("✅ lista.json generada con:", animaciones.length, "animaciones (raíz).");
