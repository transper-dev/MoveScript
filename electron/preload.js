import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    readBvh: async (filename) => {
        return await ipcRenderer.invoke('fs:read', filename);
    },
    listLocalBvh: async () => {
        return await ipcRenderer.invoke('fs:list');
    },
    saveLocalBvh: async (filename, content) => {
        return await ipcRenderer.invoke('fs:save', filename, content);
    }
});
