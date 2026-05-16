// Offline AI opponent. Three difficulty levels.
// Very simple: drive toward the opponent, attack when in range, occasionally use special.

import { distance, frontVec } from './physics.js';

export function makeAI(difficulty = 'medium') {
  const params = {
    easy:   { reactMs: 350, attackRange: 90, specialChance: 0.0008, mistake: 0.35, jitter: 0.4 },
    medium: { reactMs: 180, attackRange: 110, specialChance: 0.0014, mistake: 0.15, jitter: 0.2 },
    hard:   { reactMs: 80,  attackRange: 130, specialChance: 0.0024, mistake: 0.05, jitter: 0.1 },
  }[difficulty] || {};

  let last = { ax: 0, attack: false, special: false, t: 0 };
  let nextDecideAt = 0;

  return {
    update(self, opponent, dt, now) {
      if (!self || !opponent || self.flipped) {
        last = { ax: 0, attack: false, special: false, t: 0 };
        return last;
      }
      if (now < nextDecideAt) {
        last.attack = false;
        last.special = false;
        return last;
      }
      nextDecideAt = now + params.reactMs;

      // Drive toward opponent (sometimes back off if just attacked)
      const dx = opponent.x - self.x;
      const dy = opponent.y - self.y;
      let ax = Math.sign(dx);
      // Mistake: occasionally drive away
      if (Math.random() < params.mistake) ax = -ax;
      // Jitter
      ax = Math.max(-1, Math.min(1, ax * (1 - params.jitter * (Math.random() - 0.5))));
      // If the opponent is upside down, back off so they fall back to upright
      if (opponent.flipped) ax = -Math.sign(dx) * 0.4;

      const dist = distance(self, opponent);
      const aimedAtOpponent = (Math.sign(dx) === self.facing);
      const attack = aimedAtOpponent && dist < params.attackRange && self.attackCD <= 0.05;
      const special = self.specialCD <= 0.05 && self.chargeMeter > 0.7 && Math.random() < params.specialChance * 1000 / Math.max(60, params.reactMs);

      last = { ax, attack, special, t: now };
      return last;
    },
  };
}
