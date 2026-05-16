// Offline AI opponent. Four difficulty levels.
// Drives toward the opponent, attacks when in range, uses special on charge.

import { distance } from './physics.js';

const DIFFICULTY = {
  easy:    { reactMs: 380, attackRange: 100, specialChance: 0.0006, mistake: 0.40, jitter: 0.45, retreatHp: 0.15, attackBias: 0.7 },
  medium:  { reactMs: 200, attackRange: 115, specialChance: 0.0014, mistake: 0.15, jitter: 0.20, retreatHp: 0.10, attackBias: 0.85 },
  hard:    { reactMs: 110, attackRange: 130, specialChance: 0.0024, mistake: 0.05, jitter: 0.10, retreatHp: 0.0,  attackBias: 0.95 },
  legend:  { reactMs: 60,  attackRange: 140, specialChance: 0.0036, mistake: 0.02, jitter: 0.05, retreatHp: 0.0,  attackBias: 1.0 },
};

export function makeAI(difficulty = 'easy') {
  const params = DIFFICULTY[difficulty] || DIFFICULTY.easy;
  let last = { ax: 0, attack: false, special: false, t: 0 };
  let nextDecideAt = 0;
  let retreatTimer = 0;

  return {
    update(self, opponent, dt, now) {
      if (!self || !opponent || self.flipped) {
        last = { ax: 0, attack: false, special: false, t: 0 };
        return last;
      }
      // Allow the previous decision to ride out until next think
      if (now < nextDecideAt) {
        // Edge-fire attack only once per decision, don't spam
        const carry = { ax: last.ax, attack: false, special: false, t: last.t };
        return carry;
      }
      nextDecideAt = now + params.reactMs;

      const dx = opponent.x - self.x;
      const dist = Math.abs(dx);
      const lowHp = (self.hp / self.maxHp) < params.retreatHp;

      // Default: drive toward opponent
      let ax = Math.sign(dx) || 1;

      // Occasional mistake (drive away briefly)
      if (Math.random() < params.mistake) ax = -ax;

      // If opponent is flipped, give them space so they can fall back
      if (opponent.flipped) ax = -Math.sign(dx) * 0.4;

      // Retreat when low HP
      if (lowHp && retreatTimer <= 0 && Math.random() < 0.3) {
        retreatTimer = 0.8;
      }
      if (retreatTimer > 0) {
        ax = -Math.sign(dx) * 0.8;
        retreatTimer -= params.reactMs / 1000;
      }

      // Jitter (continuous)
      ax = clamp(ax * (1 - params.jitter * (Math.random() - 0.5)), -1, 1);

      // ATTACK CHECK — facing is set in physics from ax this same tick,
      // so as long as ax sign matches dx direction, the attack will fire forward.
      const willFaceOpponent = (Math.sign(ax) === Math.sign(dx)) || (self.facing === Math.sign(dx));
      const inRange = dist < params.attackRange;
      const attackReady = self.attackCD <= 0.02;
      const attack = willFaceOpponent && inRange && attackReady && Math.random() < params.attackBias;

      // Special when charged
      const specialReady = self.specialCD <= 0.05 && self.chargeMeter > 0.7;
      const tickFactor = 1000 / Math.max(60, params.reactMs);
      const special = specialReady && willFaceOpponent && inRange * 1.3 && Math.random() < params.specialChance * tickFactor;

      last = { ax, attack, special, t: now };
      return last;
    },
  };
}

function clamp(v, mn, mx) { return v < mn ? mn : v > mx ? mx : v; }
