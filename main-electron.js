const { app, BrowserWindow } = require('electron');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const localtunnel = require('localtunnel');

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
        console.log('🔌 Visor VR conectado:', socket.id);
        socket.on('update_code', (data) => {
            socket.broadcast.emit('execute_code', data);
        });
    });

    // Servidor y túnel
    server.listen(3000, '0.0.0.0', async () => {
        console.log('Servidor local corriendo en http://localhost:3000');
        try {
            const tunnel = await localtunnel(3000);
            console.log('Túnel VR listo en:', tunnel.url);

            if (mainWindow) {
                mainWindow.webContents.send('tunnel-url', tunnel.url);
            }
        } catch (err) {
            console.error("Error al crear el túnel:", err);
        }
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