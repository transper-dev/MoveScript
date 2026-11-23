import { app, BrowserWindow, ipcMain, session } from 'electron';
import { dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import fs from 'fs';
import { sanitizeBvhFileName } from './validator.js';
import { createDesktopServices } from './desktopServices.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_DIR = join(app.getPath('userData'), 'MoveScript_BVH');
if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR, { recursive: true });
}

function getSafeBvhPath(fileName) {
    if (typeof fileName !== 'string' || basename(fileName) !== fileName) {
        throw new Error('Invalid BVH file name.');
    }
    return join(BASE_DIR, sanitizeBvhFileName(fileName));
}

let desktopServices;

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

app.whenReady().then(async () => {
    desktopServices = createDesktopServices({
        baseDir: BASE_DIR,
        staticDir: join(__dirname, '..'),
        onTunnelStatus: (status) => BrowserWindow.getAllWindows().forEach(win => win.webContents.send('desktop:tunnel-status', status)),
        onVrStatus: (status) => BrowserWindow.getAllWindows().forEach(win => win.webContents.send('desktop:vr-status', status)),
        onTunnelStart: (onClose) => {
            const command = process.platform === 'win32' ? 'ssh.exe' : 'ssh';
            const args = ['-p', '443', '-R0:127.0.0.1:3000', '-o', 'StrictHostKeyChecking=no', 'qr@a.pinggy.io'];
            const child = execFile(command, args);
            child.once('close', onClose);
            child.once('error', onClose);
            return child;
        }
    });
    try {
        await desktopServices.start();
    } catch (error) {
        console.error(`[Desktop] Local server failed: ${error.message}`);
    }
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', async () => {
    await desktopServices?.stop();
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('fs:read', async (event, filePath) => {
    try {
        const resolvedPath = getSafeBvhPath(filePath);
        const safeName = basename(resolvedPath);

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

const MAX_BVH_CONTENT_LENGTH = 10 * 1024 * 1024;

ipcMain.handle('fs:save', async (event, filename, content) => {
    try {
        if (typeof content !== 'string' || content.length > MAX_BVH_CONTENT_LENGTH) {
            throw new Error('Invalid content or file too large.');
        }
        const resolvedPath = getSafeBvhPath(filename);
        fs.writeFileSync(resolvedPath, content, 'utf8');
        return true;
    } catch (err) {
        throw new Error(`Failed to save BVH: ${err.message}`);
    }
});

ipcMain.handle('desktop:start-vr-tunnel', () => desktopServices?.startTunnel() ?? false);
ipcMain.handle('desktop:set-osc', (event, enabled) => desktopServices?.setOscEnabled(enabled) ?? false);
