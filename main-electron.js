const { app, BrowserWindow } = require('electron');
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

    // Servidor de archivos estáticos
    expressApp.use(express.static(__dirname));
    expressApp.use('/build/', express.static(path.join(__dirname, 'node_modules/three/build')));
    expressApp.use('/jsm/', express.static(path.join(__dirname, 'node_modules/three/examples/jsm')));

    // WebSockets (Comunicación PC -> Gafas)
    io.on('connection', (socket) => {
        console.log('Visor VR conectado:', socket.id);
        socket.on('update_code', (data) => {
            socket.broadcast.emit('execute_code', data);
        });
        socket.on('vr_data', (data) => {
            if (data.c1) {
                oscClient.send('/vr/left_controller', data.c1[0], data.c1[1], data.c1[2]);
            }
            if (data.c2) {
                oscClient.send('/vr/right_controller', data.c2[0], data.c2[1], data.c2[2]);
            }
        });
    });

    // Servidor local y lanzamiento de Túnel
    server.listen(3000, '0.0.0.0', () => {
        console.log('Servidor local corriendo en http://localhost:3000');
        console.log('Abriendo terminal para el tunel VR...');

        const comando = 'start cmd.exe /k "title Tunel VR && color 0A && echo Conectando con Pinggy... && ssh -p 443 -R0:127.0.0.1:3000 -o StrictHostKeyChecking=no qr@a.pinggy.io"';
        exec(comando, (error) => {
            if (error) console.error("Error abriendo la consola:", error);
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