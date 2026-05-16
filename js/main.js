// Entry point. Wires up screens and routes between them.
// Filled in once home.js, game.js, and net.js are ready.

import { initStorage, getProfile, setProfile } from './storage.js';
import { initHome, showHome } from './home.js';
import { initGame, showGame } from './game.js';
import { initAudio } from './audio.js';
import { detectTouchDevice, toast } from './controls.js';

function boot() {
  initStorage();
  detectTouchDevice();
  initAudio();
  initHome();
  initGame();
  showHome();

  // Service-worker / PWA hook left for v2.

  window.addEventListener('error', (e) => {
    console.error('Uncaught:', e.error || e.message);
  });

  // Resume audio on first user interaction (browser policy)
  const resumeAudio = () => {
    import('./audio.js').then((m) => m.unlockAudio());
    document.removeEventListener('click', resumeAudio);
    document.removeEventListener('touchstart', resumeAudio);
    document.removeEventListener('keydown', resumeAudio);
  };
  document.addEventListener('click', resumeAudio);
  document.addEventListener('touchstart', resumeAudio, { passive: true });
  document.addEventListener('keydown', resumeAudio);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

export { showHome, showGame, toast };
