// Input handling: keyboard + touch joystick + optional tilt.
// Exposes a single `getInput()` that returns {ax, attack, special} for the local player.

import { getSettings } from './storage.js';

const state = {
  keys: new Set(),
  joystick: { active: false, dx: 0, dy: 0 },
  attackHeld: false,
  specialHeld: false,
  attackEdge: false,
  specialEdge: false,
  lastAttack: 0,
  lastSpecial: 0,
  tiltAx: 0,
  isTouch: false,
};

let attackBtn, specialBtn, joystickEl, joystickThumb;

export function detectTouchDevice() {
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
  state.isTouch = isTouch;
  if (isTouch) document.body.classList.add('touch');
}

export function initControls() {
  // Keyboard
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => state.keys.clear());

  // Touch joystick + buttons
  joystickEl = document.getElementById('joystick');
  joystickThumb = document.getElementById('joystick-thumb');
  attackBtn = document.getElementById('touch-attack');
  specialBtn = document.getElementById('touch-special');

  if (joystickEl) {
    joystickEl.addEventListener('touchstart', onJoyStart, { passive: false });
    joystickEl.addEventListener('touchmove', onJoyMove, { passive: false });
    joystickEl.addEventListener('touchend', onJoyEnd);
    joystickEl.addEventListener('touchcancel', onJoyEnd);
    joystickEl.addEventListener('mousedown', onJoyStart);
    window.addEventListener('mousemove', onJoyMove);
    window.addEventListener('mouseup', onJoyEnd);
  }
  if (attackBtn) {
    attackBtn.addEventListener('touchstart', (e) => { e.preventDefault(); state.attackHeld = true; state.attackEdge = true; }, { passive: false });
    attackBtn.addEventListener('touchend',   () => { state.attackHeld = false; });
    attackBtn.addEventListener('mousedown',  () => { state.attackHeld = true; state.attackEdge = true; });
    attackBtn.addEventListener('mouseup',    () => { state.attackHeld = false; });
  }
  if (specialBtn) {
    specialBtn.addEventListener('touchstart', (e) => { e.preventDefault(); state.specialHeld = true; state.specialEdge = true; }, { passive: false });
    specialBtn.addEventListener('touchend',   () => { state.specialHeld = false; });
    specialBtn.addEventListener('mousedown',  () => { state.specialHeld = true; state.specialEdge = true; });
    specialBtn.addEventListener('mouseup',    () => { state.specialHeld = false; });
  }

  // Tilt
  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', onTilt);
  }
}

function onKeyDown(e) {
  if (e.repeat) return;
  state.keys.add(e.code);
  if (e.code === 'Space' || e.code === 'KeyJ') state.attackEdge = true;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyK') state.specialEdge = true;
  // Prevent space scrolling
  if (e.code === 'Space') e.preventDefault();
}
function onKeyUp(e) {
  state.keys.delete(e.code);
}

function onJoyStart(e) {
  e.preventDefault();
  state.joystick.active = true;
  updateJoy(getEventPoint(e));
}
function onJoyMove(e) {
  if (!state.joystick.active) return;
  e.preventDefault();
  updateJoy(getEventPoint(e));
}
function onJoyEnd() {
  state.joystick.active = false;
  state.joystick.dx = 0;
  state.joystick.dy = 0;
  if (joystickThumb) joystickThumb.style.transform = 'translate(-50%, -50%)';
}
function getEventPoint(e) {
  if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}
function updateJoy(pt) {
  if (!joystickEl) return;
  const r = joystickEl.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  let dx = pt.x - cx;
  let dy = pt.y - cy;
  const max = r.width / 2;
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag > max) { dx = dx / mag * max; dy = dy / mag * max; }
  state.joystick.dx = dx / max;
  state.joystick.dy = dy / max;
  if (joystickThumb) {
    joystickThumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
}

function onTilt(e) {
  if (!getSettings().tilt) { state.tiltAx = 0; return; }
  // gamma is left-right tilt (-90..90). Map to ax.
  const g = e.gamma || 0;
  state.tiltAx = Math.max(-1, Math.min(1, g / 30));
}

// ----- Public ----------------------------------------------------------------

export function getInput() {
  let ax = 0;
  if (state.keys.has('KeyA') || state.keys.has('ArrowLeft'))  ax -= 1;
  if (state.keys.has('KeyD') || state.keys.has('ArrowRight')) ax += 1;
  if (state.joystick.active && Math.abs(state.joystick.dx) > 0.1) ax = state.joystick.dx;
  if (Math.abs(ax) < 0.05 && Math.abs(state.tiltAx) > 0.1) ax = state.tiltAx;
  // Edge or held — game treats both as "this tick's intent"
  const attack  = state.attackEdge  || state.attackHeld;
  const special = state.specialEdge || state.specialHeld;
  state.attackEdge = false;
  state.specialEdge = false;
  return { ax, attack, special };
}

export function isKeyDown(code) { return state.keys.has(code); }

export function setActionCooldownVisuals(attackCD, specialCD) {
  if (attackBtn)  attackBtn.classList.toggle('cooldown', attackCD > 0);
  if (specialBtn) specialBtn.classList.toggle('cooldown', specialCD > 0);
}

export function toast(msg, ms = 2200) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('visible'), ms);
}
