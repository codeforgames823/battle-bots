// Championship mode: 4-tier bracket tournament.
// Each tier is a series of fights at escalating difficulty.
// Win all fights to claim the trophy + big coin reward.

import { getProfile, setProfile, awardCoins } from './storage.js';
import { startMatch } from './game.js';
import { onChampionshipWon } from './achievements.js';
import { toast } from './controls.js';
import { getBot, drawPortrait } from './bots.js';
import { playSfx } from './audio.js';

export const TIERS = [
  {
    id: 'bronze', name: 'Bronze Cup', icon: '🥉', reward: 200, color: '#cd7f32',
    description: 'Three fights. Easy → Medium opponents.',
    fights: [
      { difficulty: 'easy',   botPool: ['wedge', 'flipper'],     name: 'Sparkbot',   color: '#ffcc66' },
      { difficulty: 'easy',   botPool: ['drum', 'flipper'],      name: 'Razor',      color: '#ff8855' },
      { difficulty: 'medium', botPool: ['lifter', 'drum'],       name: 'Bronze Fang',color: '#ff5544' },
    ],
  },
  {
    id: 'silver', name: 'Silver Cup', icon: '🥈', reward: 500, color: '#c0c0c0',
    description: 'Three fights. Medium → Hard opponents.',
    fights: [
      { difficulty: 'medium', botPool: ['drum', 'lifter'],         name: 'Flipzilla',     color: '#88aaff' },
      { difficulty: 'medium', botPool: ['hammer', 'lifter'],       name: 'Atlas',         color: '#aaffff' },
      { difficulty: 'hard',   botPool: ['hammer', 'tank'],         name: 'Silver Saint',  color: '#ccccff' },
    ],
  },
  {
    id: 'gold', name: 'Gold Cup', icon: '🥇', reward: 1000, color: '#ffd700',
    description: 'Three fights. All Hard. Win for serious coin.',
    fights: [
      { difficulty: 'hard', botPool: ['hammer', 'tank'],          name: 'Crusher',     color: '#ffaa00' },
      { difficulty: 'hard', botPool: ['tank', 'sawblade'],        name: 'Goldfang',    color: '#ffcc55' },
      { difficulty: 'hard', botPool: ['sawblade', 'mecha'],       name: 'Gold Sentinel',color: '#ffe066' },
    ],
  },
  {
    id: 'grand', name: 'Grand Championship', icon: '🏆', reward: 2500, color: '#ff3b8b',
    description: 'FOUR fights. Hard → Legend. For true champions only.',
    fights: [
      { difficulty: 'hard',   botPool: ['mecha', 'tank'],     name: 'The Reigning',     color: '#ff66cc' },
      { difficulty: 'hard',   botPool: ['mecha', 'sawblade'], name: 'Shadow Striker',   color: '#aa44ff' },
      { difficulty: 'legend', botPool: ['mecha', 'sawblade'], name: 'The Iron Tyrant',  color: '#ff2244' },
      { difficulty: 'legend', botPool: ['mecha'],             name: 'GRAND CHAMPION',   color: '#ff0066' },
    ],
  },
];

// Active run state (kept in module scope; persisted to profile.champState)
let activeRun = null;

export function getActiveRun() { return activeRun; }
export function isTierUnlocked(tierId) {
  const idx = TIERS.findIndex((t) => t.id === tierId);
  if (idx <= 0) return true; // bronze always unlocked
  const prevId = TIERS[idx - 1].id;
  return (getProfile().championships || []).includes(prevId);
}
export function isTierWon(tierId) {
  return (getProfile().championships || []).includes(tierId);
}

export function startTier(tierId) {
  const tier = TIERS.find((t) => t.id === tierId);
  if (!tier) return;
  if (!isTierUnlocked(tierId)) {
    toast('Complete the previous tier first.');
    return;
  }
  const bracket = tier.fights.map((f) => ({
    difficulty: f.difficulty,
    botId: f.botPool[Math.floor(Math.random() * f.botPool.length)],
    name: f.name,
    color: f.color,
  }));
  activeRun = { tierId, bracket, round: 0 };
  setProfile({ champState: activeRun });
  closeChampionshipModal();
  startNextFight();
}

function startNextFight() {
  if (!activeRun) return;
  const tier = TIERS.find((t) => t.id === activeRun.tierId);
  const fight = activeRun.bracket[activeRun.round];
  const total = activeRun.bracket.length;
  const label = `${tier.icon} ${tier.name} — Fight ${activeRun.round + 1}/${total}`;
  const profile = getProfile();
  startMatch({
    mode: 'ai',
    botId: profile.activeBot,
    color: profile.activeColor,
    aiDifficulty: fight.difficulty,
    aiBotId: fight.botId,
    aiName: fight.name,
    aiColor: fight.color,
    label,
    onEnd: handleChampionshipMatchEnd,
  });
}

function handleChampionshipMatchEnd({ winnerSlot, rematchRequested }) {
  if (!activeRun) return undefined;
  const tier = TIERS.find((t) => t.id === activeRun.tierId);
  const playerWon = winnerSlot === 0;
  if (!rematchRequested) {
    // First call (from endMatch). Just remember outcome.
    return undefined;
  }
  // rematchRequested = true means user clicked NEXT FIGHT / TRY AGAIN
  if (playerWon) {
    activeRun.round += 1;
    if (activeRun.round >= activeRun.bracket.length) {
      // Championship won!
      awardCoins(tier.reward);
      onChampionshipWon(tier.id);
      activeRun = null;
      setProfile({ champState: null });
      try { playSfx('win'); } catch {}
      showChampionshipResultModal({ tier, won: true });
      // Inform game.js to NOT start a default rematch
      return 'consumed';
    }
    setProfile({ champState: activeRun });
    startNextFight();
    return 'consumed';
  } else {
    // Lost — restart the tier from match 1
    const newBracket = tier.fights.map((f) => ({
      difficulty: f.difficulty,
      botId: f.botPool[Math.floor(Math.random() * f.botPool.length)],
      name: f.name,
      color: f.color,
    }));
    activeRun = { tierId: tier.id, bracket: newBracket, round: 0 };
    setProfile({ champState: activeRun });
    startNextFight();
    return 'consumed';
  }
}

// ============================================================================
// Modal UI
// ============================================================================

let modal = null;

export function openChampionshipModal() {
  if (!modal) modal = document.getElementById('modal-championship');
  if (!modal) return;
  renderChampionship();
  modal.classList.add('visible');
}

export function closeChampionshipModal() {
  if (modal) modal.classList.remove('visible');
}

function renderChampionship() {
  const container = modal?.querySelector('.champ-tiers');
  if (!container) return;
  container.innerHTML = '';
  for (const tier of TIERS) {
    const unlocked = isTierUnlocked(tier.id);
    const won = isTierWon(tier.id);
    const card = document.createElement('div');
    card.className = 'champ-tier' + (won ? ' won' : '') + (!unlocked ? ' locked' : '');
    card.style.setProperty('--tier-color', tier.color);
    card.innerHTML = `
      <div class="champ-tier-head">
        <span class="champ-tier-icon">${tier.icon}</span>
        <div class="champ-tier-title">
          <div class="champ-tier-name">${tier.name}</div>
          <div class="champ-tier-desc">${tier.description}</div>
        </div>
        ${won ? '<span class="champ-tier-badge">WON</span>' : ''}
      </div>
      <div class="champ-tier-fights"></div>
      <div class="champ-tier-foot">
        <span class="champ-reward">Reward: <strong>${tier.reward}¢</strong></span>
        <button class="btn ${won ? 'btn-secondary' : 'btn-primary'}" data-tier="${tier.id}" ${!unlocked ? 'disabled' : ''}>
          ${won ? 'Play Again' : unlocked ? 'ENTER' : 'LOCKED'}
        </button>
      </div>
    `;
    const fightsDiv = card.querySelector('.champ-tier-fights');
    tier.fights.forEach((f, i) => {
      const f0 = f.botPool[0];
      const fightEl = document.createElement('div');
      fightEl.className = 'champ-fight';
      fightEl.innerHTML = `
        <canvas width="64" height="64" data-bot="${f0}"></canvas>
        <div class="champ-fight-info">
          <div class="champ-fight-num">Fight ${i + 1}</div>
          <div class="champ-fight-name">${f.name}</div>
          <div class="champ-fight-diff diff-${f.difficulty}">${f.difficulty.toUpperCase()}</div>
        </div>
      `;
      const cv = fightEl.querySelector('canvas');
      drawPortrait(cv, f0, f.color);
      fightsDiv.appendChild(fightEl);
    });
    card.querySelector('button')?.addEventListener('click', (e) => {
      if (e.currentTarget.disabled) return;
      startTier(tier.id);
    });
    container.appendChild(card);
  }
}

function showChampionshipResultModal({ tier, won }) {
  // Reuse modal-championship as celebration screen
  if (!modal) modal = document.getElementById('modal-championship');
  if (!modal) return;
  const container = modal?.querySelector('.champ-tiers');
  if (!container) return;
  container.innerHTML = `
    <div class="champ-victory" style="--tier-color: ${tier.color}">
      <div class="champ-victory-icon">${tier.icon}</div>
      <div class="champ-victory-title">${tier.name} WON!</div>
      <div class="champ-victory-sub">+${tier.reward} coins · Trophy added to Profile</div>
      <button class="btn btn-primary btn-block" id="champ-continue">CONTINUE</button>
    </div>
  `;
  modal.classList.add('visible');
  modal.querySelector('#champ-continue')?.addEventListener('click', () => {
    renderChampionship();
  });
}

export function restoreActiveRun() {
  const saved = getProfile().champState;
  if (saved && saved.tierId && Array.isArray(saved.bracket)) {
    activeRun = saved;
  }
}

export function abandonRun() {
  activeRun = null;
  setProfile({ champState: null });
}
