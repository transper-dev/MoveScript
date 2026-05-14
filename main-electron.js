const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const osc = require('node-osc');
const client = new osc.Client('127.0.0.1', 12000);

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        title: "Movescript",
        icon: path.join(__dirname, 'icons/icon.png'),
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        }
    });

    win.loadFile('index.html');

    ipcMain.on('osc-out', (event, address, data) => {
        client.send(address, data);
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});