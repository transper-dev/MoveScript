export const EventBus = new EventTarget();

export function emit(type, detail) {
  EventBus.dispatchEvent(new CustomEvent(type, { detail }));
}

export function on(type, callback) {
  EventBus.addEventListener(type, (e) => callback(e.detail));
}
