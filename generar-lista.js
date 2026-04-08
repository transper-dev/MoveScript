const fs = require('fs');
const path = require('path');

// Miramos la carpeta assets
const rutaAssets = path.join(__dirname, 'assets');
const archivos = fs.readdirSync(rutaAssets);

// Filtramos solo los .bvh y limpiamos el nombre
const animaciones = archivos
    .filter(archivo => archivo.endsWith('.bvh'))
    .map(archivo => archivo.replace('.bvh', ''));

// Guardamos la lista en un archivo lista.json dentro de assets
const rutaJson = path.join(rutaAssets, 'lista.json');
fs.writeFileSync(rutaJson, JSON.stringify(animaciones));

console.log("✅ lista.json generada con éxito con:", animaciones.length, "animaciones.");