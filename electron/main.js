import { app, BrowserWindow, ipcMain, session } from 'electron';
import { dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { sanitizeBvhFileName } from './validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_DIR = join(app.getPath('userData'), 'MoveScript_BVH');
if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR, { recursive: true });
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        icon: join(__dirname, '../assets/icons/icon.png'),
        webPreferences: {
            preload: join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self' file: https://cdn.jsdelivr.net; " +
                    "script-src 'self' file: 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
                    "style-src 'self' file: 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; " +
                    "font-src 'self' file: https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; " +
                    "img-src 'self' file: data: https:; " +
                    "connect-src 'self' file: https://cdn.jsdelivr.net; " +
                    "worker-src 'self' blob:;"
                ]
            }
        });
    });

    mainWindow.loadFile(join(__dirname, '../index.html'));
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('fs:read', async (event, filePath) => {
    try {
        const fileBasename = basename(filePath);
        const safeName = sanitizeBvhFileName(fileBasename);
        const resolvedPath = join(BASE_DIR, safeName);

        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`File not found: ${safeName}`);
        }

        return fs.readFileSync(resolvedPath, 'utf8');
    } catch (err) {
        throw new Error(`Access denied or file error: ${err.message}`);
    }
});

ipcMain.handle('fs:list', async () => {
    try {
        if (!fs.existsSync(BASE_DIR)) return [];
        const files = fs.readdirSync(BASE_DIR);
        return files.filter(f => f.endsWith('.bvh')).map(f => f.replace('.bvh', ''));
    } catch (err) {
        return [];
    }
});

ipcMain.handle('fs:save', async (event, filename, content) => {
    try {
        const safeName = sanitizeBvhFileName(filename);
        const resolvedPath = join(BASE_DIR, safeName);
        fs.writeFileSync(resolvedPath, content, 'utf8');
        return true;
    } catch (err) {
        throw new Error(`Failed to save BVH: ${err.message}`);
    }
});
