const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { exec } = require('child_process');
const osc = require('node-osc');
const oscClient = new osc.Client('127.0.0.1', 12000);
let mainWindow;

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

        let lastSentTime = 0;

        socket.on('vr_data', (data) => {
            const now = Date.now();

            // Limitar a 60 fps (16 ms por envío máximo)
            if (now - lastSentTime >= 16) {
                const groupedData = {};

                // Posición (X, Y, Z) de ambos mandos
                if (data.c1) groupedData.leftControllerPos = data.c1;
                if (data.c2) groupedData.rightControllerPos = data.c2;

                // Rotación (X, Y, Z) de ambos mandos
                if (data.rot1) groupedData.leftControllerRot = data.rot1;
                if (data.rot2) groupedData.rightControllerRot = data.rot2;

                // Agrupar en un solo envío OSC
                oscClient.send('/vr/controllers', JSON.stringify(groupedData));

                lastSentTime = now; // Actualizar tiempo de último envío
            }
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
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});