import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rutaAssets = path.join(__dirname, 'public', 'assets', 'bvh');
let animaciones = [];

if (fs.existsSync(rutaAssets)) {
  const archivos = fs.readdirSync(rutaAssets);
  animaciones = archivos
    .filter(archivo => {
      const filePath = path.join(rutaAssets, archivo);
      return archivo.endsWith('.bvh') && fs.statSync(filePath).isFile();
    })
    .map(archivo => archivo.replace('.bvh', ''));
}

// Fallback
if (animaciones.length === 0) {
  animaciones = ["turn", "silly_walk", "monster_walk", "serious_walk"];
}

const rutaJson = path.join(__dirname, 'public', 'assets', 'lista.json');
fs.writeFileSync(rutaJson, JSON.stringify(animaciones, null, 2));

console.log("✅ lista.json generada con éxito con:", animaciones.length, "animaciones (solo raíz de assets/bvh).");
