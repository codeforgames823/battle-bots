// First-visit tutorial overlay. Shown once per profile, can be re-opened from "How to Play" tab.

const KEY = 'bb_tutorial_seen_v1';

export function initTutorial() {
  const seen = localStorage.getItem(KEY) === '1';
  if (!seen) {
    setTimeout(() => openTutorial(), 250);
  }
  document.getElementById('tutorial-skip')?.addEventListener('click', closeTutorial);
  document.getElementById('tutorial-next')?.addEventListener('click', nextStep);
  document.getElementById('modal-tutorial')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-tutorial') closeTutorial();
  });
}

let currentStep = 0;
const TOTAL_STEPS = 4;

export function openTutorial() {
  currentStep = 0;
  showStep(0);
  document.getElementById('modal-tutorial')?.classList.add('visible');
}

export function closeTutorial() {
  document.getElementById('modal-tutorial')?.classList.remove('visible');
  localStorage.setItem(KEY, '1');
}

function nextStep() {
  if (currentStep >= TOTAL_STEPS - 1) {
    closeTutorial();
    return;
  }
  currentStep += 1;
  showStep(currentStep);
}

function showStep(idx) {
  const steps = document.querySelectorAll('#modal-tutorial .tutorial-step');
  steps.forEach((s) => {
    s.hidden = Number(s.dataset.step) !== idx;
  });
  const nextBtn = document.getElementById('tutorial-next');
  if (nextBtn) nextBtn.textContent = idx >= TOTAL_STEPS - 1 ? 'LET\'S PLAY' : 'Next';
}
