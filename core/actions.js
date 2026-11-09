/**
 * Actions - Registro de acciones desacopladas para evitar dependencias circulares
 */

const actions = {
  createSandbox: null,
  createWindow: null,
  runSandbox: null,
  runAll: null,
  writeLayout: null,
  scheduleLayoutSave: null
};

export function registerActions(newActions) {
  Object.assign(actions, newActions);
}

export function getAction(name) {
  return actions[name];
}
