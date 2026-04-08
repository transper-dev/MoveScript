export const examples = [
  {
    name: "Animación Base (Default)",
    code: `
[bvh("urki")]
>[dummy(9,1)]
>[color("red", "blue")];`
  },
  {
    name: "Color Movements",
    code: `clear();
cam(0, 200, 450, 0, 100, 0);

// Creamos un bailarín y lo usamos como referencia para duplicarlo
bailarin1 = bvh("pirouette").x(-160).color("#ff0000").trail(100).play();
bailarin2 = duplicate(bailarin1).x(0).color("#ffffff").play();
bailarin3 = duplicate(bailarin1).x(160).color("#0000ff").play();
bailarin4 = duplicate(bailarin1).x(-160).z(-160).color("#00ffff").play();
bailarin5 = duplicate(bailarin1).x(0).z(-160).color("#00ff00").play();
bailarin6 = duplicate(bailarin1).x(160).z(-160).color("#ffff00").play();

// Aplicamos el modificador individual .reverse() a los nuevos clones
duplicate(bailarin1).reverse().play();
duplicate(bailarin2).reverse().play();
duplicate(bailarin3).reverse().play();
duplicate(bailarin4).reverse().play();
duplicate(bailarin5).reverse().play();
duplicate(bailarin6).reverse().play();

rot(0.1);`
  },
  {
    name: "El Tejido Colorido",
    code: `clear();
bg("#000205"); 
cam(0, 400, 700, 0, 100, 0);

// Usamos un 'molde' invisible para generar la cuadrícula
let molde = bvh("pirouette").pos(0, -2000, 0).skeleton(false).play();

let columnas = 5;
let filas = 5;
let separacion = 120;

for (let x = 0; x < columnas; x++) {
  for (let z = 0; z < filas; z++) {
    let posX = (x - columnas / 2 + 0.5) * separacion;
    let posZ = (z - filas / 2 + 0.5) * separacion;
    
    let matiz = (x / columnas) * 360;
    let retraso = (x + z) * 0.15; // Efecto de propagación (ola)
    
    let normal = duplicate(molde)
      .pos(posX, 0, posZ)
      .color(\`hsl(\${matiz}, 100%, 60%)\`)
      .delay(retraso)
      .trail(80)
      .play();
      
    // Clon simétrico en reversa con color complementario
    duplicate(normal)
      .reverse()
      .color(\`hsl(\${ matiz + 180}, 100%, 60%)\`)
      .play();
  }
}

rot(0.05);`
  },
  {
    name: "La Flor de Loto",
    code: `clear();
bg("#00030a"); 
cam(0, 1000, 1200, 0, 100, 0); 

let molde = bvh("pirouette").pos(0, -5000, 0).skeleton(false).play();

// Generamos anillos concéntricos que crecen en cantidad y tamaño
for(let r = 1; r <= 3; r++) {
  let cantidad = r * 16;  
  let radio = r * 180;
  
  for(let i = 0; i < cantidad; i++) {
    let angulo = (i / cantidad) * Math.PI * 2;
    let x = Math.cos(angulo) * radio;
    let z = Math.sin(angulo) * radio;
    
    // Alternamos la orientación para que las estelas se crucen entre sí
    let mirar = (r % 2 === 0) ? (-angulo + Math.PI/2) : (-angulo - Math.PI/2);
    let matiz = (i / cantidad * 360) + (r * 50);
    
    duplicate(molde)
      .pos(x, (r - 1) * 80, z)
      .rotY(mirar)
      .scale(0.8 + (r * 0.3))
      .color(\`hsl(\${matiz}, 100%, 60%)\`)
      .trail(45)
      .delay((i * 0.03) + (r * 0.6)) // Efecto de florecimiento temporal
      .play();
  }
}

rot(0.02);`
  },
  {
    name: "El Hiper-Túnel",
    code: `clear();
bg("black");
cam(0, 0, 50, 0, 0, -1000); // Vista desde el interior del túnel

let molde = bvh("pirouette").pos(0, -2000, 0).skeleton(false).play();

let numAnillos = 30;    
let gentePorAnillo = 10; 
let radioTunel = 250;
let longitudTunel = 2000;

for (let i = 0; i < numAnillos; i++) {
  let posZ = - (i * (longitudTunel / numAnillos)); // Profundidad

  for (let j = 0; j < gentePorAnillo; j++) {
    let angulo = (j / gentePorAnillo) * Math.PI * 2;
    let posX = Math.cos(angulo) * radioTunel;
    let posY = Math.sin(angulo) * radioTunel;
    
    let colorClon = (i % 2 === 0) ? "#00ffff" : "#ff00aa";

    duplicate(molde)
      .pos(posX, posY, posZ)
      .rotY(-angulo) // Los bailarines siguen la curvatura del túnel
      .color(colorClon)
      .trail(80)
      .delay(i * 0.15) // Sensación de viaje hacia el fondo
      .play();
  }
}

rot(0.2);`
  },
  {
    name: "La Esfera de Fibonacci",
    code: `clear();
bg("#020207");
cam(0, 0, 1200, 0, 0, 0);

let molde = bvh("pirouette").pos(0, -2000, 0).skeleton(false).play();

let cantidad = 250; 
let radioEsfera = 400;
let phi = Math.PI * (3 - Math.sqrt(5)); // Distribución uniforme (Ángulo Áureo)

for (let i = 0; i < cantidad; i++) {
  let yNorm = 1 - (i / (cantidad - 1)) * 2; 
  let radioEnY = Math.sqrt(1 - yNorm * yNorm);
  let theta = phi * i; 

  let posX = Math.cos(theta) * radioEnY * radioEsfera;
  let posY = yNorm * radioEsfera;
  let posZ = Math.sin(theta) * radioEnY * radioEsfera;

  let r = Math.floor(((yNorm + 1) / 2) * 255);
  let b = 255 - r;

  duplicate(molde)
    .pos(posX, posY, posZ)
    .rotY(-theta)
    .color(\`rgb(\${r}, 50, \${b})\`)
    .trail(30)
    .delay(i * 0.02)
    .play();
}

rot(0.1);`
  },
  {
    name: "El Sol Radiante",
    code: `clear();
bg("#000208"); 
cam(0, 0, 1500, 0, 0, 0);

// Usamos un molde invisible como base para toda la estructura
let molde = bvh("pirouette").pos(0, -2000, 0).skeleton(false).play();

let puntosNucleo = 60;
let radioNucleo = 150;
const phi = Math.PI * (3 - Math.sqrt(5)); // Distribución áurea

for (let i = 0; i < puntosNucleo; i++) {
  let y = 1 - (i / (puntosNucleo - 1)) * 2;
  let radiusAtY = Math.sqrt(1 - y * y);
  let theta = phi * i;

  let x = Math.cos(theta) * radiusAtY * radioNucleo;
  let z = Math.sin(theta) * radiusAtY * radioNucleo;
  let yPos = y * radioNucleo;

  // 1. EL NÚCLEO: Esfera central brillante con esqueletos visibles
  duplicate(molde)
    .pos(x, yPos, z)
    .color("#ffcc00")
    .trail(20)
    .speed(0.3)
    .skeleton(true)
    .play();

  // 2. RAYOS RADIANTES: Proyectamos filas de clones hacia el exterior
  if (i % 2 === 0) {
    let numBailarinesPorFila = 3;
    let distancia = 40;

    for (let j = 1; j <= numBailarinesPorFila; j++) {
      let factor = 1 + (j * distancia / radioNucleo);
      
      // Color degradado: del naranja solar al azul espacial
      let matiz = 40 - (j * 10); 

      duplicate(molde)
        .pos(x * factor, yPos * factor, z * factor)
        .color(\`hsl(\${matiz}, 100%, 50%)\`)
        .trail(50)
        .scale(1.2 - (j * 0.1)) // Los clones se encogen al alejarse del centro
        .delay(j * 0.2 + (i * 0.05)) // Efecto de expansión pulsante
        .speed(0.6)
        .play();
    }
  }
}

// Rotación lenta para apreciar la tridimensionalidad
rot(0.1);`
  },
  {
    name: "El Tesseract de Almas",
    code: `clear();
bg("#000105");
cam(800, 600, 800, 0, 0, 0);

// Usamos un esqueleto invisible para que solo el rastro de luz defina la forma
let molde = bvh("pirouette").pos(0, -2000, 0).skeleton(false).play();

let resolucion = 6; // 6x6x6 = 216 bailarines sincronizados
let tamaño = 400;

for (let x = 0; x < resolucion; x++) {
  for (let y = 0; y < resolucion; y++) {
    for (let z = 0; z < resolucion; z++) {
      
      // Calculamos la posición en un cubo 3D centrado
      let posX = (x / (resolucion - 1) - 0.5) * tamaño;
      let posY = (y / (resolucion - 1) - 0.5) * tamaño;
      let posZ = (z / (resolucion - 1) - 0.5) * tamaño;

      // Distancia al centro para crear efectos esféricos dentro del cubo
      let dist = Math.sqrt(posX*posX + posY*posY + posZ*posZ);
      
      // Color: del cian eléctrico en los bordes al blanco nuclear en el centro
      let matiz = 180 + (dist / tamaño) * 100;

      duplicate(molde)
        .pos(posX, posY, posZ)
        .color(\`hsl(\${matiz}, 100%, 70%)\`)
        .trail(40)
        .delay(dist * 0.005) 
        .speed(0.4 + (dist * 0.001))
        .play();
    }
  }
}
  
rot(0.2);`
  },
];