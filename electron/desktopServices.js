import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { Client as OscClient } from 'node-osc';

const LOOPBACK_HOST = '127.0.0.1';
const OSC_PORT = 12000;
const SERVER_PORT = 3000;
const MAX_CODE_LENGTH = 256 * 1024;
const MAX_VR_PACKET_LENGTH = 16 * 1024;

function isFiniteCoordinate(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function normalizeVrData(data) {
  const normalizeController = controller => Array.isArray(controller) && controller.length >= 2 &&
    controller.length <= 8 && controller.every(isFiniteCoordinate)
    ? controller.slice(0, 3) : null;
  return {
    c1: normalizeController(data?.c1),
    c2: normalizeController(data?.c2)
  };
}

function mapY(y, min, max) {
  return Math.floor(Math.max(0, Math.min((y - min) / (max - min), 1)) * 127);
}

export function createOscMessages(data) {
  const messages = [];
  if (data.c1) messages.push(['/vr/left_y', mapY(data.c1[1], 60, 150)]);
  if (data.c2) messages.push(['/vr/right_y', 1000 + mapY(data.c2[1], 60, 150) * (4000 / 127)]);
  return messages;
}

function isQuestSocket(socket) {
  return /Quest/i.test(socket.handshake.headers['user-agent'] || '');
}

export function createDesktopServices({ baseDir, staticDir, onTunnelStart, onTunnelStatus, onVrStatus }) {
  const expressApp = express();
  const server = http.createServer(expressApp);
  const io = new Server(server, { cors: { origin: false }, maxHttpBufferSize: MAX_VR_PACKET_LENGTH });
  const oscClient = new OscClient(LOOPBACK_HOST, OSC_PORT);

  expressApp.use('/assets', express.static(baseDir, { dotfiles: 'deny', fallthrough: false }));
  expressApp.use(express.static(staticDir, { dotfiles: 'deny', fallthrough: false }));

  let pendingVrData = null;
  let oscEnabled = false;
  let tunnelProcess = null;
  const flushTimer = setInterval(() => {
    if (!oscEnabled || !pendingVrData) return;
    const data = pendingVrData;
    pendingVrData = null;
    for (const [address, value] of createOscMessages(data)) oscClient.send(address, value);
  }, 1000 / 60);
  flushTimer.unref();

  io.on('connection', socket => {
    const isQuest = isQuestSocket(socket);
    if (isQuest) {
      onVrStatus?.('connected');
      io.emit('vr_status', { status: 'connected' });
    }
    socket.on('update_code', data => {
      if (typeof data !== 'string' && (!data || typeof data !== 'object')) return;
      if (JSON.stringify(data).length > MAX_CODE_LENGTH) return;
      socket.broadcast.emit('execute_code', data);
    });
    socket.on('vr_data', data => {
      if (!isQuest || !data || JSON.stringify(data).length > MAX_VR_PACKET_LENGTH) return;
      pendingVrData = normalizeVrData(data);
    });
    socket.on('disconnect', () => {
      if (isQuest) {
        onVrStatus?.('disconnected');
        io.emit('vr_status', { status: 'disconnected' });
      }
    });
  });

  return {
    start() {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(SERVER_PORT, LOOPBACK_HOST, () => resolve(`http://${LOOPBACK_HOST}:${SERVER_PORT}`));
      });
    },
    setOscEnabled(enabled) {
      oscEnabled = Boolean(enabled);
      if (!oscEnabled) pendingVrData = null;
      return oscEnabled;
    },
    startTunnel() {
      if (tunnelProcess) return false;
      onTunnelStatus?.('connecting');
      tunnelProcess = onTunnelStart(() => {
        tunnelProcess = null;
        onTunnelStatus?.('disconnected');
        io.emit('tunnel_status', { status: 'disconnected' });
      });
      if (!tunnelProcess) {
        onTunnelStatus?.('failed');
        return false;
      }
      tunnelProcess.once('error', () => {
        tunnelProcess = null;
        onTunnelStatus?.('failed');
      });
      return true;
    },
    stop() {
      clearInterval(flushTimer);
      if (tunnelProcess?.kill) tunnelProcess.kill();
      tunnelProcess = null;
      oscClient.close?.();
      return new Promise(resolve => server.close(() => resolve()));
    }
  };
}
