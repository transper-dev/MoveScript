const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

const BASE_DIR = 'MoveScript_BVH';

contextBridge.exposeInMainWorld('electronAPI', {
    readBvh: async (filename) => {
        // Validación básica de path traversal
        const safeFilename = path.normalize(filename).replace(/^(\.\.(\/|\\|$))+/, '');
        if (safeFilename.includes('..')) throw new Error('Security Error: Invalid path');

        return await ipcRenderer.invoke('fs:read', path.join(BASE_DIR, safeFilename));
    }
});
