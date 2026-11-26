import { capabilities } from '../platform/index.js';
import { getAction } from '../core/actions.js';

const STATES = {
  idle: { className: 'desktop-idle', label: 'Start VR Tunnel', icon: 'fas fa-vr-cardboard' },
  connecting: { className: 'desktop-connecting', label: 'Waiting VR Client...', icon: 'fas fa-spinner fa-spin' },
  connected: { className: 'desktop-connected', label: 'VR Client Connected', icon: 'fas fa-check' },
  failed: { className: 'desktop-failed', label: 'VR Tunnel Failed', icon: 'fas fa-exclamation-triangle' }
};

export function initDesktopControls() {
  const controls = document.getElementById('desktop-controls');
  if (!capabilities.isDesktop || !window.electronAPI) {
    controls?.remove();
    return;
  }
  document.body.classList.add('desktop');

  const tunnelBtn = document.getElementById('vrTunnelBtn');
  const oscBtn = document.getElementById('oscBtn');
  if (!tunnelBtn || !oscBtn || !window.electronAPI) return;

  const setState = stateName => {
    const state = STATES[stateName];
    tunnelBtn.className = `global-btn ${state.className}`;
    tunnelBtn.title = state.label;
    const icon = tunnelBtn.querySelector('i');
    const label = tunnelBtn.querySelector('.btn-label');
    if (icon) icon.className = state.icon;
    if (label) label.textContent = state.label;
  };

  const setOscState = (stateName, label) => {
    oscBtn.classList.remove('desktop-idle', 'desktop-connected', 'desktop-failed');
    oscBtn.classList.add(`desktop-${stateName}`);
    const oscLabel = oscBtn.querySelector('.btn-label');
    if (oscLabel) oscLabel.textContent = label;
  };

  window.electronAPI.onTunnelStatus(status => {
    setState(status === 'failed' ? 'failed' : status === 'disconnected' ? 'idle' : 'connecting');
  });
  window.electronAPI.onVrStatus(status => {
    setState(status === 'connected' ? 'connected' : 'idle');
    if (status === 'connected') {
      const runAll = getAction('runAll');
      if (runAll) runAll();
    }
  });

  setState('idle');
  setOscState('idle', 'OSC: Off');
  tunnelBtn.addEventListener('click', async () => {
    if (tunnelBtn.classList.contains('desktop-connecting') || tunnelBtn.classList.contains('desktop-connected')) return;
    setState('connecting');
    try {
      const started = await window.electronAPI.startVrTunnel();
      if (!started) setState('failed');
    } catch (error) {
      console.error(error);
      setState('failed');
    }
  });

  let oscEnabled = false;
  oscBtn.addEventListener('click', async () => {
    try {
      oscEnabled = await window.electronAPI.setOscEnabled(!oscEnabled);
      setOscState(oscEnabled ? 'connected' : 'idle', `OSC: ${oscEnabled ? 'On' : 'Off'}`);
    } catch (error) {
      oscEnabled = false;
      setOscState('failed', 'OSC: Error');
    }
  });
}
