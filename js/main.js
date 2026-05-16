// Entry point. Wires up screens and routes between them.
// Filled in once home.js, game.js, and net.js are ready.

import { initStorage } from './storage.js';
import { initHome, showHome, handleDeepLink } from './home.js';
import { initGame } from './game.js';
import { initAudio } from './audio.js';
import { detectTouchDevice, toast } from './controls.js';
import { initTutorial } from './tutorial.js';
import { restoreActiveRun } from './championship.js';
import { checkAndUnlock } from './achievements.js';

function boot() {
  initStorage();
  detectTouchDevice();
  initAudio();
  initHome();
  initGame();
  showHome();
  restoreActiveRun();
  initTutorial();
  // Backfill any newly-applicable achievements when profile updated externally
  checkAndUnlock();
  handleDeepLink();

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

export { showHome, toast };
