import { JSDOM } from 'jsdom';
import * as THREE from 'three';

// Mock WebGLRenderer to be compatible with Node
THREE.WebGLRenderer = class MockRenderer {
  constructor(opts) {
    this.domElement = opts.canvas || document.createElement('canvas');
  }
  setPixelRatio() {}
  setSize() {}
  setClearColor() {}
  render() {}
  // Add other methods that WebGLRenderer might call in scene.js
  dispose() {}
};

const dom = new JSDOM('<!DOCTYPE html><html><body><canvas id="c"></canvas></body></html>', {
  pretendToBeVisual: true
});

global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
global.devicePixelRatio = 1;
