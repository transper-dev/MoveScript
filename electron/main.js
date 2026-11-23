const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { sanitizeBvhFileName } = require('./validator.js');

const BASE_DIR = path.join(app.getPath('userData'), 'MoveScript_BVH');
if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR, { recursive: true });
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    // CSP Estricta
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': ["default-src 'self' https://cdn.jsdelivr.net; script-src 'self' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; font-src 'self' https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self' https://cdn.jsdelivr.net;"]
            }
        });
    });

    mainWindow.loadFile(path.join(__dirname, '../index.html'));
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.stop();
});

// IPC handler seguro con validación
ipcMain.handle('fs:read', async (event, filePath) => {
    try {
        const basename = path.basename(filePath);
        const safeName = sanitizeBvhFileName(basename);
        const resolvedPath = path.join(BASE_DIR, safeName);

        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`File not found: ${safeName}`);
        }

        return fs.readFileSync(resolvedPath, 'utf8');
    } catch (err) {
        throw new Error(`Access denied or file error: ${err.message}`);
    }
});
