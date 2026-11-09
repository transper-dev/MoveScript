/**
 * BVH - BVH Loader and animation management engine
 * createBvh(), duplicateHandle(), makeChain() and related utilities
 */

import * as THREE from "three";
import { BVHLoader } from "three/addons/loaders/BVHLoader.js";
import { scene } from './scene.js';
import { send } from './utils.js';
import { MessageTypes } from '../shared/protocol.js';

/**
 * Crea un handle para cargar y controlar una animación BVH
 */
export function createBvh(ctx, fileOrUrl, isChained = false) {
  const handle = {
    _ctx: ctx, _runId: ctx.runId,
    _rawFile: fileOrUrl, _x: 0, _y: 0, _z: 0, _rotX: 0, _rotY: 0, _rotZ: 0,
    _xExplicit: false,
    _scale: null, _showSkeleton: null, _speed: null, _reverse: null,
    _color: null, _color2: null, _trail: null, _delay: null,

    _useDummy: false, _reqBones: false, _reqJoints: false, _enforceProportions: false,
    _boneWidth: null, _boneLength: null, _jointSize: null,

    _isStaticDummy: false,

    _codeIndex: (!isChained ? ctx.bvhCounter++ : null),
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

    x(v) { this._x = v; this._xExplicit = true; return this; },
    y(v) { this._y = v; return this; },
    z(v) { this._z = v; return this; },
    pos(x, y, z) { this._x = x; this._y = y; this._z = z; this._xExplicit = true; return this; },
    rotX(r) { this._rotX = r; return this; },
    rotY(r) { this._rotY = r; return this; },
    rotZ(r) { this._rotZ = r; return this; },
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
        _useDummy: true, _reqBones: true,
        _boneWidth: width, _boneLength: (length !== undefined ? length : null)
      });
    },
    joints(size) {
      return this._propagate({ _useDummy: true, _reqJoints: true, _jointSize: size });
    },

    play() {
      this._isPlaying = true;
      const rig = ctx.rigs.find(r => r.handle === this);
      if (rig && rig.action) rig.action.paused = false;
      return this;
    },

    nextBvh(nextFile) {
      const nextHandle = createBvh(ctx, nextFile, true);
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

  const myRunId = handle._runId;

  ctx.later(async () => {
    const urlDefinitiva = fileOrUrl.startsWith("http")
      ? fileOrUrl
      : `./assets/${fileOrUrl}.bvh`;

    if (myRunId !== ctx.runId) return;

    const loader = new BVHLoader();
    loader.load(urlDefinitiva, (result) => {
      if (myRunId !== ctx.runId || ctx.disposed) return;

      const root = result.skeleton.bones[0];
      const group = new THREE.Group();

      const pivot = new THREE.Group();
      pivot.rotation.set(handle._rotX, handle._rotY, handle._rotZ);
      pivot.add(root);
      group.add(pivot);

      const mixer = new THREE.AnimationMixer(root);
      const action = mixer.clipAction(result.clip);

      if (handle._isChained) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      action.play();
      if (!handle._isPlaying || (handle._isChained && !handle._isHead)) {
        action.paused = true;
      }

      const isReversed = handle._reverse ?? ctx.params.reverse;
      const localSpeed = handle._speed ?? 1.0;

      mixer.timeScale = ctx.params.speed * localSpeed * (isReversed ? -1 : 1);

      if (isReversed) { action.time = result.clip.duration; }

      let maxBoneLength = 0;
      root.traverse(b => {
        if (b.isBone) {
          let len = b.position.length();
          if (len > maxBoneLength) maxBoneLength = len;
        }
      });

      let autoScale = (maxBoneLength < 5) ? 100 : 1;
      let finalScale = autoScale * (handle._scale ?? ctx.params.globalScale);

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

      const targetX = handle._xExplicit ? handle._x : ctx.defaultX;
      let offsetX = targetX - rootWorldPos.x;
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
        helper.visible = (handle._showSkeleton ?? ctx.params.showSkeleton);
      }
      scene.add(helper);

      const col1 = handle._color ?? ctx.params.color;
      const col2 = handle._color2 ?? ctx.params.color2;
      let useGradient = false;
      let colorInicio, colorFin;

      if (col1 && !col2) {
        useGradient = false;
        colorInicio = new THREE.Color(col1);
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
          colors[i * 3] = colorInicio.r;
          colors[i * 3 + 1] = colorInicio.g;
          colors[i * 3 + 2] = colorInicio.b;
          colors[(i + 1) * 3] = colorFin.r;
          colors[(i + 1) * 3 + 1] = colorFin.g;
          colors[(i + 1) * 3 + 2] = colorFin.b;
        }
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      }

      if (handle._useDummy) {
        helper.visible = (handle._showSkeleton ?? false);

        const dummyMat = new THREE.MeshStandardMaterial({
          color: useGradient ? 0xffffff : colorInicio,
          vertexColors: useGradient,
          roughness: 0.5,
          metalness: 0.2
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
          baseCylGeom.setAttribute("color", new THREE.Float32BufferAttribute(cylColors, 3));

          const sphereColors = [];
          for (let i = 0; i < baseSphereGeom.attributes.position.count; i++) {
            sphereColors.push(colorInicio.r, colorInicio.g, colorInicio.b);
          }
          baseSphereGeom.setAttribute("color", new THREE.Float32BufferAttribute(sphereColors, 3));
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

      mixer.addEventListener("finished", () => {
        if (myRunId !== ctx.runId || ctx.disposed) return;
        if (handle._isChained && handle._nextHandle) {
          helper.visible = false;
          if (handle._useDummy) root.visible = false;

          const ejecutarRelevo = (nextRig) => {
            const currentPos = new THREE.Vector3();
            root.getWorldPosition(currentPos);

            nextRig.action.reset();

            const isNextReversed = nextRig.opts.reverse ?? ctx.params.reverse;
            const nextLocalSpeed = nextRig.opts.speed ?? 1.0;

            nextRig.mixer.timeScale = ctx.params.speed * nextLocalSpeed * (isNextReversed ? -1 : 1);

            if (isNextReversed) {
              nextRig.action.time = nextRig.clip.duration;
            }

            nextRig.action.paused = !!handle._nextHandle._isStaticDummy;

            nextRig.mixer.update(0.05);

            const nextRootStartPos = new THREE.Vector3();
            nextRig.root.getWorldPosition(nextRootStartPos);

            nextRig.group.position.x += (currentPos.x - nextRootStartPos.x);
            nextRig.group.position.z += (currentPos.z - nextRootStartPos.z);

            if (handle._nextHandle._useDummy) {
              nextRig.root.visible = true;
            }
            else {
              nextRig.helper.visible = (handle._nextHandle._showSkeleton ?? ctx.params.showSkeleton);
            }
            nextRig.timeAlive = 0.05;

            nextRig.action.play();

            if (handle._nextHandle._isStaticDummy) {
              const waitTime = (handle._nextHandle._delay ?? 3) * 1000;
              ctx.later(() => {
                nextRig.mixer.dispatchEvent({ type: "finished", action: nextRig.action });
              }, waitTime);
            }

            send(MessageTypes.CHAIN_STEP, ctx.id, { codeIndex: nextRig.handle._codeIndex, step: nextRig.handle._chainStep });
          };

          const nextRig = ctx.rigs.find(r => r.handle === handle._nextHandle);
          if (nextRig) {
            ejecutarRelevo(nextRig);
          }
          else {
            handle._nextHandle._onRigLoaded = (loadedRig) => ejecutarRelevo(loadedRig);
          }
        }
      });

      const rigRecord = {
        ctx, handle, group, pivot, root, helper, mixer, action, clip: result.clip, timeAlive: 0, autoScale,
        opts: {
          rotX: handle._rotX, rotY: handle._rotY, rotZ: handle._rotZ,
          speed: (handle._speed ?? 1.0),
          showSkeleton: (handle._showSkeleton ?? null),
          scale: (handle._scale ?? null),
          reverse: handle._reverse,
          color: handle._color,
          color2: handle._color2,
          trail: handle._trail,
          delay: handle._delay
        }
      };
      ctx.rigs.push(rigRecord);
      if (handle._onRigLoaded) {
        handle._onRigLoaded(rigRecord);
      }
    }, undefined, () => {
      if (myRunId !== ctx.runId) return;
      send(MessageTypes.ERROR, ctx.id, { message: `No se encuentra la animación: ${fileOrUrl}.bvh` });
    });
  }, 0);

  return handle;
}

const DUPLICATE_KEYS = ["_x", "_xExplicit", "_y", "_z", "_scale", "_rotX", "_rotY", "_rotZ", "_showSkeleton", "_speed", "_reverse", "_color", "_color2", "_trail", "_delay", "_useDummy", "_reqBones", "_reqJoints", "_enforceProportions", "_boneWidth", "_boneLength", "_jointSize", "_isStaticDummy"];

/**
 * Duplica un handle BVH existente con todas sus propiedades
 */
export function duplicateHandle(ctx, originalHandle) {
  if (!originalHandle || !originalHandle._rawFile) throw new Error("duplicate() necesita una variable.");
  const startOrig = originalHandle._chainHead || originalHandle;

  let newCurrent = createBvh(ctx, startOrig._rawFile, true);
  newCurrent._codeIndex = ctx.bvhCounter++;
  DUPLICATE_KEYS.forEach(k => newCurrent[k] = startOrig[k]);
  const newHead = newCurrent;

  if (startOrig._isChained) {
    let currentOrig = startOrig._nextHandle;
    while (currentOrig && currentOrig !== startOrig) {
      newCurrent = newCurrent.nextBvh(currentOrig._rawFile);
      DUPLICATE_KEYS.forEach(k => newCurrent[k] = currentOrig[k]);
      currentOrig = currentOrig._nextHandle;
    }
  }

  if (startOrig._isPlaying) newHead.play();
  return newHead;
}

// ====================================================
// PATRÓN BUILDER: RigNode + CHAIN
// ====================================================
export class RigNode {
  constructor() { this.props = {}; }
  bvh(f) { this.props.file = f; return this; }
  duplicate(h) { this.props.duplicate = h; return this; }

  dummy(v = true) { this.props.calledDummy = true; this.props.dummyValue = v; return this; }
  bones(w, l) { this.props.calledBones = true; this.props.boneWidth = w; this.props.boneLength = l; return this; }
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

function applyPropsToHandle(handle, props) {
  if (props.x !== undefined) handle.pos(props.x, props.y ?? 0, props.z ?? 0);

  if (props.calledDummy) handle.dummy(props.dummyValue);
  if (props.calledBones) handle.bones(props.boneWidth, props.boneLength);
  if (props.calledJoints) handle.joints(props.jointSize);

  if (props.calledBones || props.calledJoints) handle._useDummy = true;

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

/**
 * Crea un constructor CHAIN ligado a un contexto
 */
export function makeChain(ctx) {
  return (...nodes) => {
    if (nodes.length === 0) return;

    const headNode = nodes[0];
    let file = headNode.props.file;
    let isStaticDummy = false;

    if (!file && !headNode.props.duplicate) {
      file = "deep_breath";
      isStaticDummy = true;
    }

    const headHandle = headNode.props.duplicate
      ? duplicateHandle(ctx, headNode.props.duplicate)
      : createBvh(ctx, file);

    headHandle._isStaticDummy = isStaticDummy;
    applyPropsToHandle(headHandle, headNode.props);

    if (isStaticDummy) {
      const waitTime = (headNode.props.delay ?? 3) * 1000;
      ctx.later(() => {
        const rig = ctx.rigs.find(r => r.handle === headHandle);
        if (rig) rig.mixer.dispatchEvent({ type: "finished", action: rig.action });
      }, waitTime);
    } else {
      headHandle.play();
    }

    send(MessageTypes.CHAIN_STEP, ctx.id, { codeIndex: headHandle._codeIndex, step: 0 });

    let currentHandle = headHandle;
    for (let i = 1; i < nodes.length; i++) {
      const nextNode = nodes[i];
      const nextFile = nextNode.props.file || currentHandle._rawFile;
      const nextHandle = currentHandle.nextBvh(nextFile);
      nextHandle._isStaticDummy = (!nextNode.props.file && currentHandle._isStaticDummy);
      applyPropsToHandle(nextHandle, nextNode.props);
      currentHandle = nextHandle;
    }
    return headHandle;
  };
}
