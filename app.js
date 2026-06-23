const express = require('express')
const http = require('http');
const { Server } = require('socket.io');
const path = require('path')

const app = express()
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname))
app.use('/build/', express.static(path.join(__dirname, 'node_modules/three/build')))
app.use('/jsm/', express.static(path.join(__dirname, 'node_modules/three/examples/jsm')))

io.on('connection', (socket) => {
    console.log('Nuevo dispositivo conectado:', socket.id);

    socket.on('update_code', (data) => {
        socket.broadcast.emit('execute_code', data);
    });

    socket.on('disconnect', () => {
        console.log('Dispositivo desconectado:', socket.id);
    });
});

server.listen(3000, '0.0.0.0', () => {
    console.log('Servidor Editor: http://localhost:3000');
    console.log('Servidor Gafas: Entra desde el visor a http://<TU_IP_LOCAL>:3000/visor.html');
});
