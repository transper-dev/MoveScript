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
