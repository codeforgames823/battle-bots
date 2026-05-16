// Achievements: small set of unlockable badges. Stored in profile.achievements (array of ids).
// Triggered after each match by onMatchPlayed(...). Pure local logic.

import { getProfile, setProfile, awardCoins } from './storage.js';
import { toast } from './controls.js';
import { playSfx } from './audio.js';

export const ACHIEVEMENTS = [
  { id: 'first_blood',     name: 'First Blood',     desc: 'Win your first match.',                reward: 25,  icon: '🩸', check: (p) => p.wins >= 1 },
  { id: 'flipper',         name: 'Flipper',         desc: 'Flip 5 opponents.',                    reward: 25,  icon: '↺',  check: (p) => p.flips >= 5 },
  { id: 'streaker',        name: 'On a Roll',       desc: 'Win 3 matches in a row.',              reward: 50,  icon: '🔥', check: (p) => p.bestWinStreak >= 3 },
  { id: 'collector',       name: 'Collector',       desc: 'Own 3 different bots.',                reward: 50,  icon: '🧰', check: (p) => p.ownedBots.length >= 3 },
  { id: 'champion_bronze', name: 'Bronze Champion', desc: 'Win the Bronze Cup.',                  reward: 100, icon: '🥉', check: (p) => (p.championships || []).includes('bronze') },
  { id: 'champion_silver', name: 'Silver Champion', desc: 'Win the Silver Cup.',                  reward: 200, icon: '🥈', check: (p) => (p.championships || []).includes('silver') },
  { id: 'champion_gold',   name: 'Gold Champion',   desc: 'Win the Gold Cup.',                    reward: 400, icon: '🥇', check: (p) => (p.championships || []).includes('gold') },
  { id: 'grand_champion',  name: 'GRAND CHAMPION',  desc: 'Win the Grand Championship.',          reward: 1000,icon: '🏆', check: (p) => (p.championships || []).includes('grand') },
  { id: 'tycoon',          name: 'Tycoon',          desc: 'Bank 1000 coins at once.',             reward: 50,  icon: '💰', check: (p) => p.coins >= 1000 },
  { id: 'veteran',         name: 'Veteran',         desc: 'Play 25 matches.',                     reward: 75,  icon: '🎖️', check: (p) => (p.wins + p.losses) >= 25 },
  { id: 'survivor',        name: 'Survivor',        desc: 'Win a match by HP at time-up.',        reward: 30,  icon: '⏱️', check: (p) => p.timeoutWins >= 1 },
  { id: 'underdog',        name: 'Underdog',        desc: 'Beat a Hard or Legend AI.',            reward: 75,  icon: '🐺', check: (p) => (p.hardWins || 0) >= 1 },
];

export function onMatchPlayed({ won, reason, opponentBotId, difficulty }) {
  const p = getProfile();
  const patch = {};
  if (won && reason === 'time') patch.timeoutWins = (p.timeoutWins || 0) + 1;
  if (won && (difficulty === 'hard' || difficulty === 'legend')) patch.hardWins = (p.hardWins || 0) + 1;
  if (Object.keys(patch).length) setProfile(patch);
  checkAndUnlock();
}

export function onChampionshipWon(tier) {
  const p = getProfile();
  const list = Array.isArray(p.championships) ? p.championships.slice() : [];
  if (!list.includes(tier)) list.push(tier);
  setProfile({ championships: list });
  checkAndUnlock();
}

export function checkAndUnlock() {
  const p = getProfile();
  const have = new Set(p.achievements || []);
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.id)) continue;
    try {
      if (a.check(p)) {
        have.add(a.id);
        newly.push(a);
      }
    } catch (e) { /* ignore */ }
  }
  if (newly.length === 0) return [];
  setProfile({ achievements: Array.from(have) });
  let totalReward = 0;
  for (const a of newly) {
    totalReward += a.reward;
    toast(`${a.icon} ${a.name} unlocked! +${a.reward}¢`);
  }
  if (totalReward > 0) awardCoins(totalReward);
  try { playSfx('win'); } catch {}
  return newly;
}

export function getUnlocked() {
  const ids = new Set(getProfile().achievements || []);
  return ACHIEVEMENTS.map((a) => ({ ...a, unlocked: ids.has(a.id) }));
}
