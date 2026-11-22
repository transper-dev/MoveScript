import { JSDOM } from 'jsdom';
import * as THREE from 'three';

const dom = new JSDOM('<!DOCTYPE html><html><body><canvas id="c"></canvas></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost'
});

global.window = dom.window;
global.document = dom.window.document;
global.THREE = THREE;
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
global.localStorage = dom.window.localStorage;
global.devicePixelRatio = 1;

// Mock global.window.__MS_PROFILE__ for platform selection
global.__MS_PROFILE__ = 'web';

import fs from 'node:fs';
import path from 'node:path';

// Mock fetch
const listaJsonContent = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/assets/lista.json'), 'utf8'));
global.fetch = async (url) => ({
  ok: true,
  json: async () => listaJsonContent
});

const canvasProto = dom.window.HTMLCanvasElement.prototype;
canvasProto.getContext = function(type) {
  if (type === 'webgl' || type === 'webgl2' || type === '2d') {
    return {
      canvas: this,
      getExtension: () => null,
      getParameter: (p) => {
        if (p === 7938 || p === 35724) return 'WebGL 2.0 (OpenGL ES 3.0)';
        if (p === 7937) return 'Mozilla';
        if (p === 7936) return 'WebGL';
        return 0;
      },
      enable: () => {},
      disable: () => {},
      blendFunc: () => {},
      depthFunc: () => {},
      viewport: () => {},
      clear: () => {},
      clearColor: () => {},
      createShader: () => ({}),
      shaderSource: () => {},
      compileShader: () => {},
      getShaderParameter: () => true,
      createProgram: () => ({}),
      attachShader: () => {},
      linkProgram: () => {},
      getProgramParameter: () => true,
      useProgram: () => {},
      createBuffer: () => ({}),
      bindBuffer: () => {},
      bufferData: () => {},
      createTexture: () => ({}),
      bindTexture: () => {},
      texImage2D: () => {},
      texParameteri: () => {},
      drawArrays: () => {},
      drawElements: () => {},
      getError: () => 0,
      getShaderPrecisionFormat: () => ({ rangeMin: 1, rangeMax: 1, precision: 1 }),
      fillRect: () => {},
      clearRect: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      putImageData: () => {},
      createImageData: () => ([]),
      setTransform: () => {},
      drawImage: () => {},
      save: () => {},
      fillText: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      arc: () => {},
      fill: () => {},
      measureText: () => ({ width: 0 }),
      transform: () => {},
      rect: () => {},
      clip: () => {}
    };
  }
  return null;
};

import { setEditorFactory } from '../src/ui/editorFactory.js';

// Mock CodeMirror for testing UI components
global.CodeMirror = {
    fromTextArea: (textarea, options) => {
        let val = textarea.value || '';
        return {
            getValue: () => val,
            setValue: (v) => { val = v; },
            on: (event, cb) => {},
            off: (event, cb) => {},
            lineCount: () => val.split('\n').length,
            getLine: (i) => val.split('\n')[i] || '',
            setBookmark: () => ({ clear: () => {} }),
            refresh: () => {},
            getCursor: () => ({ line: 0, ch: 0 }),
            posFromIndex: (idx) => ({ line: 0, ch: idx }),
            focus: () => {},
            setSelection: () => {},
            replaceRange: () => {},
            markText: () => ({ clear: () => {} }),
            addLineClass: () => {},
            removeLineClass: () => {}
        };
    }
};

setEditorFactory(global.CodeMirror);

import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
BVHLoader.prototype.load = function(url, onLoad) {
  setTimeout(() => {
    onLoad({
      skeleton: { bones: [new THREE.Bone()] },
      clip: new THREE.AnimationClip('test', 1, [])
    });
  }, 0);
};

