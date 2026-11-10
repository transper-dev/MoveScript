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
            setSelection: () => {},
            replaceRange: () => {},
            markText: () => ({ clear: () => {} }),
            addLineClass: () => {},
            removeLineClass: () => {}
        };
    }
};
