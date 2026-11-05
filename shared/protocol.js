/**
 * Protocol - Mensajes entre main.js (parent) y bvhApi.js (iframe)
 * Define los tipos de mensajes postMessage enviados entre la ventana principal y el iframe preview
 */

export const MessageTypes = {
  // De main.js -> iframe
  EXECUTE: 'execute',           // Ejecutar código en un sandbox { sandboxId, order, code }
  PAUSE: 'pause',               // Pausar/reanudar globalmente { paused }
  PAUSE_SANDBOX: 'pauseSandbox', // Pausar/reanudar un sandbox { sandboxId, paused }
  REMOVE_SANDBOX: 'removeSandbox', // Eliminar un sandbox { sandboxId }
  REMOTE_KEY: 'remoteKey',      // Tecla de navegación cuando rig seleccionado { sandboxId, key, shiftKey }

  // De iframe -> main.js
  READY: 'ready',               // Motor 3D listo
  ERROR: 'error',               // Error de ejecución { sandboxId, message }
  CHAIN_UPDATE: 'chainUpdate',  // Actualización de cadena activa { sandboxId, step, total }
  RIG_SELECT: 'rigSelect'       // Selección de rig { sandboxId, selected }
};

/**
 * Crea un mensaje para enviar al iframe
 */
export function createMessage(type, payload = {}) {
  return { type, ...payload };
}

/**
 * Valida que un mensaje recibido tenga el tipo esperado
 */
export function isMessageType(message, expectedType) {
  return message && message.type === expectedType;
}
