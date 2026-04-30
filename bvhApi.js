import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BVHLoader } from "three/addons/loaders/BVHLoader.js";

// --- CONFIGURACIÓN DE ESCENA ---
const canvas = document.getElementById("c");
canvas.addEventListener("pointerdown", () => canvas.focus());

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(60, 2, 0.1, 20000);
camera.position.set(0, 200, 450);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 120, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.25));
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(3, 5, 2);
scene.add(light);

THREE.Cache.enabled = true;

// --- MOTOR BVH ---
const clock = new THREE.Clock();
const rigs = [];
const mixers = [];
const activeTrails = [];
let frameCount = 0;
let runId = 0;

let bvhCounter = 0;
let selectedRig = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const selectionBox = new THREE.BoxHelper(new THREE.Group(), 0xffff00);
selectionBox.visible = false;
scene.add(selectionBox);

const SB = {
  params: { speed: 1.0, pause: false, showSkeleton: true, globalScale: 1.0, rotSpeed: 0.0, reverse: false, color: null, color2: null, trail: 0, delay: 0 },

  grid(size = 400, div = 10) { scene.add(new THREE.GridHelper(size, div)); return SB; },
  cam(x = 0, y = 200, z = 450, lx = 0, ly = 120, lz = 0) { camera.position.set(x, y, z); controls.target.set(lx, ly, lz); return SB; },
  background(color) { scene.background = new THREE.Color(color); return SB; },
  bg(color) { return this.background(color); },

  clear() {
    runId++;
    bvhCounter = 0;
    selectedRig = null;
    selectionBox.visible = false;

    this.params = { speed: 1.0, pause: false, showSkeleton: true, globalScale: 1.0, rotSpeed: 0.0, reverse: false, color: null, color2: null, trail: 0, delay: 0 };

    for (const r of rigs) {
      if (r.mixer) r.mixer.stopAllAction();

      if (r.helper) {
        scene.remove(r.helper);
        if (r.helper.geometry) r.helper.geometry.dispose();
        if (r.helper.material) r.helper.material.dispose();
      }

      if (r.group) {
        scene.remove(r.group);
        r.group.traverse((child) => {
          if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
      }
    }

    for (const t of activeTrails) {
      scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mesh.material.dispose();
    }
    activeTrails.length = 0; rigs.length = 0; mixers.length = 0;

    const grids = scene.children.filter(obj => obj.type === "GridHelper");
    for (const g of grids) {
      scene.remove(g);
      g.geometry.dispose();
      g.material.dispose();
    }

    controls.autoRotate = false;
    controls.autoRotateSpeed = 0;
    scene.background = new THREE.Color(0x111111);

    return SB;
  },

  bvh(fileOrUrl, isChained = false) {
    let url;
    if (fileOrUrl.startsWith("http")) {
      url = fileOrUrl;
    } else {
      if (navigator.onLine) {
        url = `https://raw.githubusercontent.com/transper-dev/MoveScript/refs/heads/main/assets/${fileOrUrl}.bvh`;
      } else {
        url = `./assets/${fileOrUrl}.bvh`;
      }
    }

    const handle = {
      _rawFile: fileOrUrl, _url: url, _x: 0, _y: 0, _z: 0, _rotX: 0, _rotY: 0, _rotZ: 0,
      _scale: null, _showSkeleton: null, _speed: null, _reverse: null,
      _color: null, _color2: null, _trail: null, _delay: null,

      _useDummy: false, _reqBones: false, _reqJoints: false, _enforceProportions: false,
      _boneWidth: null, _boneLength: null, _jointSize: null,

      _isStaticDummy: false,

      _codeIndex: (!isChained ? bvhCounter++ : null),
      _chainStep: 0,
      _isPlaying: false, _isChained: false, _isHead: true, _chainHead: null, _nextHandle: null,

      _propagate(props) {
        Object.assign(this, props);
        if (this._isChained && this._isHead) {
          let curr = this._nextHandle;
          while (curr && curr !== this) {
            Object.assign(curr, props);
            curr = curr._nextHandle;
          }
        }
        return this;
      },

      x(v) { this._x = v; return this; }, y(v) { this._y = v; return this; }, z(v) { this._z = v; return this; },
      pos(x, y, z) { this._x = x; this._y = y; this._z = z; return this; },
      rotX(r) { this._rotX = r; return this; }, rotY(r) { this._rotY = r; return this; }, rotZ(r) { this._rotZ = r; return this; },
      delay(s) { this._delay = s; return this; },

      scale(s) { return this._propagate({ _scale: s }); },
      skeleton(v) { return this._propagate({ _showSkeleton: v }); },
      speed(v) { return this._propagate({ _speed: v }); },
      reverse(v = true) { return this._propagate({ _reverse: v }); },
      color(c1, c2) { return this._propagate({ _color: c1, _color2: c2 }); },
      trail(length) { return this._propagate({ _trail: length }); },

      dummy(v = true) {
        const estado = !!v;
        return this._propagate({ _useDummy: estado, _reqBones: estado, _reqJoints: estado, _enforceProportions: estado });
      },
      bones(width, length) {
        return this._propagate({
          _useDummy: true,
          _reqBones: true,
          _boneWidth: width,
          _boneLength: (length !== undefined ? length : null)
        });
      },
      joints(size) {
        return this._propagate({
          _useDummy: true,
          _reqJoints: true,
          _jointSize: size
        });
      },

      play() {
        this._isPlaying = true;
        const rig = rigs.find(r => r.handle === this);
        if (rig && rig.action) rig.action.paused = false;
        return this;
      },

      nextBvh(nextFile) {
        const nextHandle = SB.bvh(nextFile, true);
        nextHandle._isHead = false;
        nextHandle._isPlaying = this._isPlaying;

        nextHandle._color = this._color;
        nextHandle._color2 = this._color2;
        nextHandle._scale = this._scale;
        nextHandle._speed = this._speed;
        nextHandle._trail = this._trail;
        nextHandle._showSkeleton = this._showSkeleton;
        nextHandle._reverse = this._reverse;

        nextHandle._useDummy = this._useDummy;
        nextHandle._reqBones = this._reqBones;
        nextHandle._reqJoints = this._reqJoints;
        nextHandle._enforceProportions = this._enforceProportions;
        nextHandle._boneWidth = this._boneWidth;
        nextHandle._boneLength = this._boneLength;
        nextHandle._jointSize = this._jointSize;

        nextHandle._rotX = this._rotX;
        nextHandle._rotY = this._rotY;
        nextHandle._rotZ = this._rotZ;

        this._isChained = true;
        nextHandle._isChained = true;
        nextHandle._chainHead = this._chainHead || this;
        nextHandle._nextHandle = nextHandle._chainHead;
        this._nextHandle = nextHandle;

        nextHandle._codeIndex = nextHandle._chainHead._codeIndex;
        nextHandle._chainStep = this._chainStep + 1;

        return nextHandle;
      }
    };

    const myRunId = runId;

    setTimeout(async () => {
      let urlDefinitiva = "";

      if (fileOrUrl.startsWith("http")) {
        urlDefinitiva = fileOrUrl;
      } else {
        urlDefinitiva = `./assets/${fileOrUrl}.bvh`;

        try {
          const comprobacionLocal = await fetch(urlDefinitiva, { method: 'HEAD' });
          if (!comprobacionLocal.ok) {
            if (navigator.onLine) {
              urlDefinitiva = `https://cdn.jsdelivr.net/gh/transper-dev/MoveScript@main/assets/${fileOrUrl}.bvh`;
            } else {
              throw new Error("Archivo no encontrado en local y no hay internet.");
            }
          }
        } catch (e) {
          if (navigator.onLine) {
            urlDefinitiva = `https://cdn.jsdelivr.net/gh/transper-dev/MoveScript@main/assets/${fileOrUrl}.bvh`;
          }
        }
      }

      const loader = new BVHLoader();
      loader.load(urlDefinitiva, (result) => {
        if (myRunId !== runId) return;

        const root = result.skeleton.bones[0];
        const group = new THREE.Group();

        const pivot = new THREE.Group();
        pivot.rotation.set(handle._rotX, handle._rotY, handle._rotZ);
        pivot.add(root); group.add(pivot);

        const mixer = new THREE.AnimationMixer(root);
        const action = mixer.clipAction(result.clip);

        if (handle._isChained) { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; }
        action.play();
        if (!handle._isPlaying || (handle._isChained && !handle._isHead)) { action.paused = true; }

        const isReversed = handle._reverse ?? SB.params.reverse;
        const localSpeed = handle._speed ?? 1.0;

        mixer.timeScale = SB.params.speed * localSpeed * (isReversed ? -1 : 1);

        if (isReversed) { action.time = result.clip.duration; }

        let maxBoneLength = 0;
        root.traverse(b => {
          if (b.isBone) {
            let len = b.position.length();
            if (len > maxBoneLength) maxBoneLength = len;
          }
        });

        let autoScale = (maxBoneLength < 5) ? 100 : 1;
        let finalScale = autoScale * (handle._scale ?? SB.params.globalScale);

        group.scale.setScalar(finalScale);
        group.position.set(0, 0, 0);

        mixer.update(0.05);
        group.updateMatrixWorld(true);

        let lowestY = Infinity;
        let rootWorldPos = new THREE.Vector3();

        let hipsBone = root;
        if (root.children.length === 1 && root.position.lengthSq() < 0.001) {
          hipsBone = root.children[0];
        }
        hipsBone.getWorldPosition(rootWorldPos);

        root.traverse(b => {
          if (b.isBone && b !== root) {
            let pos = new THREE.Vector3();
            b.getWorldPosition(pos);
            if (pos.y < lowestY) lowestY = pos.y;
          }
        });

        let offsetX = handle._x - rootWorldPos.x;
        let offsetZ = handle._z - rootWorldPos.z;

        let offsetY = handle._y;
        if (handle._y === 0 && lowestY !== Infinity) {
          offsetY = -lowestY;
        }

        group.position.set(offsetX, offsetY, offsetZ);
        group.updateMatrixWorld(true);

        scene.add(group);

        const helper = new THREE.SkeletonHelper(root);
        helper.skeleton = result.skeleton;

        if (handle._isChained && !handle._isHead) {
          helper.visible = false;
        } else {
          helper.visible = (handle._showSkeleton ?? SB.params.showSkeleton);
        }
        scene.add(helper);

        const col1 = handle._color ?? SB.params.color;
        const col2 = handle._color2 ?? SB.params.color2;
        let useGradient = false;
        let colorInicio, colorFin;

        if (col1 && !col2) {
          useGradient = false; colorInicio = new THREE.Color(col1);
          helper.material.vertexColors = false;
          helper.material.color.set(colorInicio);
        } else {
          useGradient = true;
          colorInicio = new THREE.Color(col1 || "#00ffcc");
          colorFin = new THREE.Color(col2 || "#0055ff");
          helper.material.vertexColors = true;
          helper.material.color.set(0xffffff);

          const geometry = helper.geometry;
          const positions = geometry.attributes.position;
          const colors = new Float32Array(positions.count * 3);

          for (let i = 0; i < positions.count; i += 2) {
            colors[i * 3] = colorInicio.r; colors[i * 3 + 1] = colorInicio.g; colors[i * 3 + 2] = colorInicio.b;
            colors[(i + 1) * 3] = colorFin.r; colors[(i + 1) * 3 + 1] = colorFin.g; colors[(i + 1) * 3 + 2] = colorFin.b;
          }
          geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }

        if (handle._useDummy) {
          helper.visible = (handle._showSkeleton ?? false);

          const dummyMat = new THREE.MeshStandardMaterial({
            color: useGradient ? 0xffffff : colorInicio,
            vertexColors: useGradient,
            roughness: 0.5, metalness: 0.2
          });

          const baseSphereGeom = new THREE.SphereGeometry(1, 12, 12);
          const baseCylGeom = new THREE.CylinderGeometry(1, 1, 1, 8);
          baseCylGeom.translate(0, 0.5, 0);

          if (useGradient) {
            const cylPos = baseCylGeom.attributes.position;
            const cylColors = [];
            for (let i = 0; i < cylPos.count; i++) {
              const mixedColor = colorInicio.clone().lerp(colorFin, cylPos.getY(i));
              cylColors.push(mixedColor.r, mixedColor.g, mixedColor.b);
            }
            baseCylGeom.setAttribute('color', new THREE.Float32BufferAttribute(cylColors, 3));

            const sphereColors = [];
            for (let i = 0; i < baseSphereGeom.attributes.position.count; i++) {
              sphereColors.push(colorInicio.r, colorInicio.g, colorInicio.b);
            }
            baseSphereGeom.setAttribute('color', new THREE.Float32BufferAttribute(sphereColors, 3));
          }

          root.traverse((bone) => {
            if (bone.isBone) {
              let hasChildren = false;
              let maxChildLength = 0;

              if (bone.children.length > 0) {
                bone.children.forEach((child) => {
                  if (child.isBone) {
                    hasChildren = true;
                    const length = child.position.length();
                    maxChildLength = Math.max(maxChildLength, length);

                    if (handle._reqBones && length > 0.01) {
                      const mesh = new THREE.Mesh(baseCylGeom, dummyMat);

                      const boneLenMulti = handle._boneLength ?? 1.0;
                      const longitudVisible = length * boneLenMulti;
                      let boneThickness = handle._boneWidth ?? (length * 0.25);

                      if (handle._enforceProportions) {
                        boneThickness = Math.min(boneThickness, length * 0.35);
                      }

                      mesh.scale.set(boneThickness, longitudVisible, boneThickness);
                      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), child.position.clone().normalize());
                      bone.add(mesh);
                    }
                  }
                });
              }

              if (handle._reqJoints) {
                let jointSize = handle._jointSize;
                let limiteNatural = hasChildren ? Math.max(0.5, maxChildLength * 0.35) : Math.max(0.5, bone.position.length() * 0.2);

                if (jointSize === null || jointSize === undefined) {
                  jointSize = limiteNatural;
                } else if (handle._enforceProportions) {
                  jointSize = Math.min(jointSize, limiteNatural * 1.5);
                }

                if (jointSize > 0) {
                  const jointMesh = new THREE.Mesh(baseSphereGeom, dummyMat);
                  jointMesh.scale.setScalar(jointSize);
                  bone.add(jointMesh);
                }
              }
            }
          });

          root.visible = !(handle._isChained && !handle._isHead);
        }

        mixer.addEventListener('finished', (e) => {
          if (handle._isChained && handle._nextHandle) {
            helper.visible = false;
            if (handle._useDummy) root.visible = false;

            const ejecutarRelevo = (nextRig) => {
              const currentPos = new THREE.Vector3();
              root.getWorldPosition(currentPos);

              nextRig.action.reset();

              const isNextReversed = nextRig.opts.reverse ?? SB.params.reverse;
              const nextLocalSpeed = nextRig.opts.speed ?? 1.0;

              nextRig.mixer.timeScale = SB.params.speed * nextLocalSpeed * (isNextReversed ? -1 : 1);

              if (isNextReversed) {
                nextRig.action.time = nextRig.clip.duration;
              }

              if (handle._nextHandle._isStaticDummy) {
                nextRig.action.paused = true;
              } else {
                nextRig.action.paused = false;
              }

              nextRig.mixer.update(0.05);

              const nextRootStartPos = new THREE.Vector3();
              nextRig.root.getWorldPosition(nextRootStartPos);

              nextRig.group.position.x += (currentPos.x - nextRootStartPos.x);
              nextRig.group.position.z += (currentPos.z - nextRootStartPos.z);

              if (handle._nextHandle._useDummy) { nextRig.root.visible = true; }
              else { nextRig.helper.visible = (handle._nextHandle._showSkeleton ?? SB.params.showSkeleton); }
              nextRig.timeAlive = 0.05;

              nextRig.action.play();

              if (handle._nextHandle._isStaticDummy) {
                const waitTime = (handle._nextHandle._delay ?? 3) * 1000;
                setTimeout(() => {
                  nextRig.mixer.dispatchEvent({ type: 'finished', action: nextRig.action });
                }, waitTime);
              }

              window.parent.postMessage({ type: 'chainStep', codeIndex: nextRig.handle._codeIndex, step: nextRig.handle._chainStep }, '*');
            };

            const nextRig = rigs.find(r => r.handle === handle._nextHandle);
            if (nextRig) { ejecutarRelevo(nextRig); }
            else {
              const waitInterval = setInterval(() => {
                const delayedRig = rigs.find(r => r.handle === handle._nextHandle);
                if (delayedRig) { clearInterval(waitInterval); ejecutarRelevo(delayedRig); }
              }, 50);
            }
          }
        });

        rigs.push({
          handle, group, pivot, root, helper, mixer, action, clip: result.clip, timeAlive: 0,
          opts: { rotX: handle._rotX, rotY: handle._rotY, rotZ: handle._rotZ, speed: (handle._speed ?? 1.0), showSkeleton: (handle._showSkeleton ?? null), scale: (handle._scale ?? null), reverse: handle._reverse, color: handle._color, color2: handle._color2, trail: handle._trail, delay: handle._delay }
        });
        mixers.push(mixer);
      }, undefined, (err) => {
        window.parent.postMessage({ type: 'error', message: `No se encuentra la animación: ${fileOrUrl}.bvh` }, '*');
      });
    }, 0);

    return handle;
  },

  duplicate(originalHandle) {
    if (!originalHandle || !originalHandle._rawFile) throw new Error("duplicate() necesita una variable.");
    const startOrig = originalHandle._chainHead || originalHandle;

    let newCurrent = this.bvh(startOrig._rawFile, true);
    newCurrent._codeIndex = bvhCounter++;

    const keysToCopy = ["_x", "_y", "_z", "_scale", "_rotX", "_rotY", "_rotZ", "_showSkeleton", "_speed", "_reverse", "_color", "_color2", "_trail", "_delay", "_useDummy", "_reqBones", "_reqJoints", "_enforceProportions", "_boneWidth", "_boneLength", "_jointSize", "_isStaticDummy"];
    keysToCopy.forEach(k => newCurrent[k] = startOrig[k]);
    const newHead = newCurrent;

    if (startOrig._isChained) {
      let currentOrig = startOrig._nextHandle;
      while (currentOrig && currentOrig !== startOrig) {
        newCurrent = newCurrent.nextBvh(currentOrig._rawFile);
        keysToCopy.forEach(k => newCurrent[k] = currentOrig[k]);
        currentOrig = currentOrig._nextHandle;
      }
    }

    if (startOrig._isPlaying) newHead.play();
    return newHead;
  },

  speed(v) { SB.params.speed = v; return SB; }, pause(v = true) { SB.params.pause = v; return SB; },
  skeleton(v = true) { SB.params.showSkeleton = v; return SB; }, scale(v) { SB.params.globalScale = v; return SB; },
  rot(v) {
    SB.params.rotSpeed = v;
    if (v !== 0) { controls.autoRotate = true; controls.autoRotateSpeed = v * 20; }
    else { controls.autoRotate = false; }
    return SB;
  },
  reverse(v = true) { SB.params.reverse = v; return SB; },
  color(c1, c2) { SB.params.color = c1; SB.params.color2 = c2; return SB; }, trail(v) { SB.params.trail = v; return SB; }, delay(s) { SB.params.delay = s; return SB; },

  _tick() {
    const dt = clock.getDelta(); frameCount++;

    if (selectedRig && selectionBox.visible) {
      const activeRig = rigs.find(r =>
        (r.handle === selectedRig.handle || r.handle._chainHead === selectedRig.handle) &&
        (r.handle._useDummy ? r.root.visible : (r.helper && r.helper.visible))
      );
      if (activeRig) {
        selectionBox.setFromObject(activeRig.handle._useDummy ? activeRig.group : activeRig.helper);
      }
    }

    for (const r of rigs) {
      if (r.group) { r.group.scale.setScalar((r.opts.scale ?? SB.params.globalScale)); }

      const trailLen = r.opts.trail ?? SB.params.trail;
      const delayTime = r.opts.delay ?? SB.params.delay;
      const isVisible = r.handle._useDummy ? r.root.visible : (r.helper && r.helper.visible);

      if (!SB.params.pause && trailLen > 0 && frameCount % 6 === 0 && isVisible && r.timeAlive >= delayTime) {
        const snapGeom = r.helper.geometry.clone(); snapGeom.applyMatrix4(r.helper.matrixWorld);
        const snapMat = r.helper.material.clone(); snapMat.transparent = true; snapMat.opacity = 0.6;
        const snapLine = new THREE.LineSegments(snapGeom, snapMat); scene.add(snapLine);
        activeTrails.push({ mesh: snapLine, life: 0.6, decay: 0.6 / trailLen });
      }
    }

    for (let i = activeTrails.length - 1; i >= 0; i--) {
      const t = activeTrails[i]; t.life -= t.decay; t.mesh.material.opacity = t.life;
      if (t.life <= 0) { scene.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh.material.dispose(); activeTrails.splice(i, 1); }
    }

    if (!SB.params.pause) {
      for (let i = 0; i < mixers.length; i++) {
        const r = rigs[i]; const delayTime = r.opts?.delay ?? SB.params.delay;
        const isVisible = r.handle._useDummy ? r.root.visible : (r.helper && r.helper.visible);

        if (r.handle._isChained && r.handle !== r.handle._chainHead && !isVisible && r.timeAlive === 0) continue;

        const tiempoAnterior = r.timeAlive;
        r.timeAlive += dt;
        if (r.timeAlive < delayTime) continue;

        let tiempoActivo = dt;
        if (tiempoAnterior < delayTime) tiempoActivo = r.timeAlive - delayTime;

        const localSpeed = r?.opts?.speed ?? 1.0; const isReversed = r.opts?.reverse ?? SB.params.reverse;
        mixers[i].timeScale = SB.params.speed * localSpeed * (isReversed ? -1 : 1);

        if (isReversed && r.action && r.clip && !r.handle._isChained) {
          if (r.action.time <= 0.0001) r.action.time = r.clip.duration;
        }

        mixers[i].update(tiempoActivo);
      }
    }
  }
};

window.clear = () => SB.clear(); window.grid = (a, b) => SB.grid(a, b);
window.cam = (x, y, z, lx, ly, lz) => SB.cam(x, y, z, lx, ly, lz); window.bvh = (fileOrUrl) => SB.bvh(fileOrUrl);
window.speed = (v) => SB.speed(v); window.pause = (v = true) => SB.pause(v);
window.skeleton = (v = true) => SB.skeleton(v); window.scale = (v) => SB.scale(v);
window.rot = (v) => SB.rot(v); window.reverse = (v) => SB.reverse(v);
window.color = (c1, c2) => SB.color(c1, c2); window.trail = (l) => SB.trail(l);
window.delay = (s) => SB.delay(s); window.duplicate = (h) => SB.duplicate(h);
window.background = (c) => SB.background(c); window.bg = (c) => SB.bg(c);

function resize() {
  const w = canvas.clientWidth; const h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
}

function animate() { resize(); controls.update(); SB._tick(); renderer.render(scene, camera); requestAnimationFrame(animate); }
animate();

// --- SISTEMA DE SELECCIÓN ---
raycaster.params.Line.threshold = 20;
let editMode = 'position';

window.addEventListener('pointerdown', (e) => {
  if (e.target !== canvas) return;

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const objectsToTest = [];
  rigs.forEach(r => {
    if (r.handle._useDummy) {
      objectsToTest.push(r.group);
    } else {
      if (r.helper && r.helper.visible) {
        r.helper.geometry.computeBoundingSphere();
        r.helper.geometry.computeBoundingBox();
        objectsToTest.push(r.helper);
      }
    }
  });

  const intersects = raycaster.intersectObjects(objectsToTest, true);

  if (intersects.length > 0) {
    let hitObject = intersects[0].object;

    let hitRig = rigs.find(r => {
      let found = false;
      if (r.helper === hitObject) found = true;
      r.group.traverse(child => { if (child === hitObject) found = true; });
      return found;
    });

    if (hitRig) {
      const newlySelectedRig = hitRig.handle._chainHead ? rigs.find(r => r.handle === hitRig.handle._chainHead) : hitRig;

      if (selectedRig === newlySelectedRig) {
        editMode = (editMode === 'position') ? 'rotation' : 'position';
      } else {
        selectedRig = newlySelectedRig;
        editMode = 'position';
      }

      selectionBox.material.color.setHex(editMode === 'position' ? 0xffff00 : 0x00ffff);

      const activeRig = rigs.find(r => (r.handle === selectedRig.handle || r.handle._chainHead === selectedRig.handle) && (r.handle._useDummy ? r.root.visible : (r.helper && r.helper.visible)));
      if (activeRig) selectionBox.setFromObject(activeRig.handle._useDummy ? activeRig.group : activeRig.helper);

      selectionBox.visible = true;
      controls.enabled = false;

      window.parent.postMessage({ type: 'rigSelected', codeIndex: selectedRig.handle._codeIndex }, '*');
    }
  } else {
    selectedRig = null;
    selectionBox.visible = false;
    window.parent.postMessage({ type: 'rigDeselected' }, '*');
  }
});

window.addEventListener('pointerup', () => { controls.enabled = true; });

window.addEventListener('keydown', (e) => {
  if (!selectedRig) return;

  const cadenaRigs = rigs.filter(r => r.handle === selectedRig.handle || r.handle._chainHead === selectedRig.handle);

  if (editMode === 'position') {
    const step = e.shiftKey ? 20 : 5;
    let moved = false;
    let dx = 0, dz = 0;

    if (e.key === 'ArrowUp') { dz -= step; moved = true; }
    if (e.key === 'ArrowDown') { dz += step; moved = true; }
    if (e.key === 'ArrowLeft') { dx -= step; moved = true; }
    if (e.key === 'ArrowRight') { dx += step; moved = true; }

    if (moved) {
      cadenaRigs.forEach(r => {
        r.group.position.x += dx;
        r.group.position.z += dz;
        r.handle._x = r.group.position.x;
        r.handle._z = r.group.position.z;
      });

      window.parent.postMessage({
        type: 'rigMoved',
        codeIndex: selectedRig.handle._codeIndex,
        x: selectedRig.group.position.x,
        z: selectedRig.group.position.z
      }, '*');
    }
  }
  else if (editMode === 'rotation') {
    const angleStep = e.shiftKey ? 0.5 : 0.1;
    let rotated = false;
    let dRotX = 0, dRotY = 0;

    if (e.key === 'ArrowLeft') { dRotY += angleStep; rotated = true; }
    if (e.key === 'ArrowRight') { dRotY -= angleStep; rotated = true; }
    if (e.key === 'ArrowUp') { dRotX -= angleStep; rotated = true; }
    if (e.key === 'ArrowDown') { dRotX += angleStep; rotated = true; }

    if (rotated) {
      cadenaRigs.forEach(r => {
        r.pivot.rotation.x += dRotX;
        r.pivot.rotation.y += dRotY;
        r.handle._rotX = r.pivot.rotation.x;
        r.handle._rotY = r.pivot.rotation.y;
      });

      window.parent.postMessage({
        type: 'rigRotated',
        codeIndex: selectedRig.handle._codeIndex,
        rotX: selectedRig.pivot.rotation.x,
        rotY: selectedRig.pivot.rotation.y
      }, '*');
    }
  }
});

window.addEventListener('error', (event) => {
  window.parent.postMessage({ type: 'error', message: event.message }, '*');
});

window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'execute') {
    try { const ejecutar = new Function(event.data.code); ejecutar(); }
    catch (error) { window.parent.postMessage({ type: 'error', message: error.stack || error.message }, '*'); }
  } else if (event.data && event.data.type === 'remoteKey') {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: event.data.key,
      shiftKey: event.data.shiftKey
    }));
  }
});

window.parent.postMessage({ type: 'ready' }, '*');

// ====================================================
// PATRÓN BUILDER: BOLSA DE LA COMPRA Y HERENCIA DE BVH
// ====================================================
class RigNode {
  constructor() { this.props = {}; }
  bvh(f) { this.props.file = f; return this; }
  duplicate(h) { this.props.duplicate = h; return this; }

  dummy(v = true) { this.props.calledDummy = true; this.props.dummyValue = v; return this; } bones(w, l) { this.props.calledBones = true; this.props.boneWidth = w; this.props.boneLength = l; return this; }
  joints(s) { this.props.calledJoints = true; this.props.jointSize = s; return this; }

  color(c1, c2) { this.props.color1 = c1; this.props.color2 = c2; return this; }
  pos(x, y, z) { this.props.x = x; this.props.y = y; this.props.z = z; return this; }
  rotX(r) { this.props.rotX = r; return this; }
  rotY(r) { this.props.rotY = r; return this; }
  rotZ(r) { this.props.rotZ = r; return this; }
  scale(s) { this.props.scale = s; return this; }
  speed(s) { this.props.speed = s; return this; }
  delay(s) { this.props.delay = s; return this; }
  reverse(v = true) { this.props.reverse = v; return this; }
  skeleton(v = true) { this.props.skeleton = v; return this; }
  trail(l) { this.props.trail = l; return this; }
}

window.$B = () => new RigNode();

window.CHAIN = (...nodes) => {
  if (nodes.length === 0) return;

  let headNode = nodes[0];
  let file = headNode.props.file;
  let esManiquiEstatico = false;

  if (!file && !headNode.props.duplicate) {
    file = "hand_moves"; // Archivo por defecto para estáticos
    esManiquiEstatico = true;
  }

  let headHandle;
  if (headNode.props.duplicate) {
    headHandle = SB.duplicate(headNode.props.duplicate);
  } else {
    headHandle = SB.bvh(file);
  }

  headHandle._isStaticDummy = esManiquiEstatico;

  applyPropsToHandle(headHandle, headNode.props);

  if (esManiquiEstatico) {
    const tiempoEspera = (headNode.props.delay ?? 3) * 1000;
    setTimeout(() => {
      const rig = rigs.find(r => r.handle === headHandle);
      if (rig) {
        rig.mixer.dispatchEvent({ type: 'finished', action: rig.action });
      }
    }, tiempoEspera);
  } else {
    headHandle.play();
  }

  window.parent.postMessage({ type: 'chainStep', codeIndex: headHandle._codeIndex, step: 0 }, '*');

  let currentHandle = headHandle;
  for (let i = 1; i < nodes.length; i++) {
    let nextNode = nodes[i];

    let nextFile = nextNode.props.file || currentHandle._rawFile;

    let nextHandle = currentHandle.nextBvh(nextFile);

    nextHandle._isStaticDummy = (!nextNode.props.file && currentHandle._isStaticDummy);

    applyPropsToHandle(nextHandle, nextNode.props);
    currentHandle = nextHandle;
  }
  return headHandle;
};

function applyPropsToHandle(handle, props) {
  if (props.x !== undefined) handle.pos(props.x, props.y ?? 0, props.z ?? 0);

  if (props.calledDummy) handle.dummy(props.dummyValue);
  if (props.calledBones) handle.bones(props.boneWidth, props.boneLength);
  if (props.calledJoints) handle.joints(props.jointSize);

  if (props.calledBones || props.calledJoints) {
    handle._useDummy = true;
  }

  if (props.color1 !== undefined) handle.color(props.color1, props.color2);
  if (props.rotX !== undefined) handle.rotX(props.rotX);
  if (props.rotY !== undefined) handle.rotY(props.rotY);
  if (props.rotZ !== undefined) handle.rotZ(props.rotZ);
  if (props.scale !== undefined) handle.scale(props.scale);
  if (props.speed !== undefined) handle.speed(props.speed);
  if (props.delay !== undefined) handle.delay(props.delay);
  if (props.reverse !== undefined) handle.reverse(props.reverse);
  if (props.skeleton !== undefined) handle.skeleton(props.skeleton);
  if (props.trail !== undefined) handle.trail(props.trail);
}