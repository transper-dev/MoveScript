const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { exec } = require('child_process');
const osc = require('node-osc');
const oscClient = new osc.Client('127.0.0.1', 12000);
let mainWindow;

let autoUpdater = null;
try {
    ({ autoUpdater } = require('electron-updater'));
} catch (e) {}

function setupAutoUpdater() {
    if (!autoUpdater || !app.isPackaged) return;
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.error('[Updater] Error buscando actualizaciones:', err);
    });
}

function startServerAndTunnel() {
    const expressApp = express();
    const server = http.createServer(expressApp);
    const io = new Server(server, { cors: { origin: "*" } });

    const fs = require('fs');
    const path = require('path');

    const isDev = process.execPath.toLowerCase().includes('electron');
    const isMac = process.platform === 'darwin';

    let basePath;
    if (isDev) {
        basePath = process.cwd();
    } else if (isMac) {
        const os = require('os');
        basePath = path.join(os.homedir(), 'Documents');
    } else {
        basePath = path.dirname(process.execPath);
    }

    const customBvhPath = path.join(basePath, 'MoveScript_BVH');
    if (!fs.existsSync(customBvhPath)) {
        fs.mkdirSync(customBvhPath, { recursive: true });
    }

    expressApp.use('/assets', express.static(customBvhPath));
    expressApp.use('/assets', express.static(path.join(__dirname, 'assets', 'bvh')));

    expressApp.use(express.static(__dirname));
    expressApp.use('/build/', express.static(path.join(__dirname, 'node_modules/three/build')));
    expressApp.use('/jsm/', express.static(path.join(__dirname, 'node_modules/three/examples/jsm')));

    // Buffer desacoplado para batching de telemetría VR -> OSC
    let pendingVrData = null;
    let isVrDataDirty = false;

    const oscFlushTimer = setInterval(() => {
        if (!isVrDataDirty || !pendingVrData) return;
        isVrDataDirty = false;

        const groupedData = {};
        if (pendingVrData.c1) groupedData.leftControllerPos = pendingVrData.c1;
        if (pendingVrData.c2) groupedData.rightControllerPos = pendingVrData.c2;
        if (pendingVrData.rot1) groupedData.leftControllerRot = pendingVrData.rot1;
        if (pendingVrData.rot2) groupedData.rightControllerRot = pendingVrData.rot2;

        oscClient.send('/vr/controllers', JSON.stringify(groupedData), (err) => {
            if (err) {} // Prevenir excepciones no controladas si el puerto UDP está cerrado
        });
    }, 16);
    oscFlushTimer.unref();

    // WebSockets (Comunicación PC -> Gafas)
    io.on('connection', (socket) => {
        const userAgent = socket.handshake.headers['user-agent'] || '';
        const referer = socket.handshake.headers.referer || '';

        if (userAgent.includes('OculusBrowser') || userAgent.includes('Quest')) {
            console.log('\x1b[32m[VR] >>> Meta Quest conectadas con exito! (ID: ' + socket.id + ')\x1b[0m');
            io.emit('vr_status', { status: 'connected' });
        } else if (referer.includes('visor.html')) {
            console.log('\x1b[90m[Local] Visor 3D interno cargado\x1b[0m');
        } else {
            console.log('\x1b[90m[Local] Interfaz principal cargada\x1b[0m');
        }

        socket.on('update_code', (data) => {
            socket.broadcast.emit('execute_code', data);
        });

        socket.on('vr_data', (data) => {
            pendingVrData = data;
            isVrDataDirty = true;
        });

        socket.on('disconnect', () => {
            if (userAgent.includes('OculusBrowser') || userAgent.includes('Quest')) {
                console.log('\x1b[31m[VR] Meta Quest desconectadas\x1b[0m');
                io.emit('vr_status', { status: 'disconnected' });
            }
        });
    });

    // Servidor local 
    server.listen(3000, '0.0.0.0', () => {
        console.log('Servidor local corriendo en http://localhost:3000');
    });

    // Escuchador
    let procesoTunel = null;

    ipcMain.on('iniciar-tunel-vr', () => {
        // Si el proceso ya existe, ignoramos los clics repetidos
        if (procesoTunel) return;

        let comando = '';
        const comandoSSH = 'ssh -p 443 -R0:127.0.0.1:3000 -o StrictHostKeyChecking=no qr@a.pinggy.io';

        if (process.platform === 'win32') {
            // Usamos 'start /wait' y 'cmd /c' para que Node detecte el cierre de la ventana
            comando = `start /wait cmd.exe /c "title Tunel VR && color 0A && mode con: cols=90 lines=30 && echo Conectando con Pinggy... && ${comandoSSH}"`;
        } else if (process.platform === 'darwin') {
            comando = `osascript -e 'tell app "Terminal" to do script "echo Conectando con Pinggy... && ${comandoSSH}"'`;
        } else {
            comando = `x-terminal-emulator -e "bash -c \\"echo Conectando con Pinggy... && ${comandoSSH}; exec bash\\""`;
        }

        // Ejecutamos y guardamos el proceso en la variable
        procesoTunel = exec(comando, (error) => {
            // Esto se ejecuta JUSTO cuando cierras la terminal negra con la 'X'
            procesoTunel = null; // Vaciamos la variable
            io.emit('tunel_cerrado'); // Avisamos al frontend
        });
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        title: "MoveScript VR",
        icon: path.join(__dirname, 'icons/icon.png'),
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    startServerAndTunnel();
    createWindow();
    setupAutoUpdater();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});