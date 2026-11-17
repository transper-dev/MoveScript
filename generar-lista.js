import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getBvhFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getBvhFiles(filePath, fileList);
    } else if (file.endsWith('.bvh')) {
      fileList.push(file.replace('.bvh', ''));
    }
  });
  return fileList;
}

const rutaAssets = path.join(__dirname, 'assets', 'bvh');
let animaciones = getBvhFiles(rutaAssets);

// Fallback
if (animaciones.length === 0) {
  animaciones = ["turn", "silly_walk", "monster_walk", "serious_walk"];
}

const rutaJson = path.join(__dirname, 'assets', 'lista.json');
fs.writeFileSync(rutaJson, JSON.stringify(animaciones, null, 2));

console.log("✅ lista.json generada con éxito con:", animaciones.length, "animaciones.");
