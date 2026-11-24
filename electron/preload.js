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
    },
    startVrTunnel: () => ipcRenderer.invoke('desktop:start-vr-tunnel'),
    broadcastCode: (code) => ipcRenderer.invoke('desktop:broadcast-code', code),
    setOscEnabled: (enabled) => ipcRenderer.invoke('desktop:set-osc', Boolean(enabled)),
    onTunnelStatus: (callback) => {
        if (typeof callback !== 'function') return () => {};
        const listener = (_event, status) => callback(status);
        ipcRenderer.on('desktop:tunnel-status', listener);
        return () => ipcRenderer.removeListener('desktop:tunnel-status', listener);
    },
    onVrStatus: (callback) => {
        if (typeof callback !== 'function') return () => {};
        const listener = (_event, status) => callback(status);
        ipcRenderer.on('desktop:vr-status', listener);
        return () => ipcRenderer.removeListener('desktop:vr-status', listener);
    }
});
