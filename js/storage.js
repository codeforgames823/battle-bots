// localStorage wrapper, guest UUID, settings, owned bots cache.
// Authoritative state lives on the server when API is reachable; this is the local cache.

const KEY_PROFILE = 'bb_profile_v1';
const KEY_SETTINGS = 'bb_settings_v1';
const KEY_API = 'bb_api'; // override base URL of backend
const KEY_TOKEN = 'bb_token_v1'; // server-issued guest token

const DEFAULT_PROFILE = {
  username: '',
  coins: 100,
  ownedBots: ['wedge'],
  activeBot: 'wedge',
  activeColor: '#00eaff',
  wins: 0,
  losses: 0,
  flips: 0,
  bestWinStreak: 0,
  currentWinStreak: 0,
  achievements: [],
  createdAt: Date.now(),
};

const DEFAULT_SETTINGS = {
  master: 0.8,
  music: 0.6,
  sfx: 0.8,
  tilt: false,
  hifx: true,
};

let profile = { ...DEFAULT_PROFILE };
let settings = { ...DEFAULT_SETTINGS };

export function initStorage() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY_PROFILE) || 'null');
    if (p) profile = { ...DEFAULT_PROFILE, ...p };
  } catch {}
  try {
    const s = JSON.parse(localStorage.getItem(KEY_SETTINGS) || 'null');
    if (s) settings = { ...DEFAULT_SETTINGS, ...s };
  } catch {}
  if (!profile.username) {
    profile.username = randomUsername();
    saveProfile();
  }
}

export function getProfile() {
  return profile;
}
export function setProfile(patch) {
  profile = { ...profile, ...patch };
  saveProfile();
  return profile;
}
export function ownsBot(botId) {
  return profile.ownedBots.includes(botId);
}
export function addOwnedBot(botId) {
  if (!profile.ownedBots.includes(botId)) {
    profile.ownedBots = [...profile.ownedBots, botId];
    saveProfile();
  }
}
export function spendCoins(amount) {
  if (profile.coins < amount) return false;
  profile.coins -= amount;
  saveProfile();
  return true;
}
export function awardCoins(amount) {
  profile.coins += amount;
  saveProfile();
  return profile.coins;
}
export function recordWin() {
  profile.wins += 1;
  profile.currentWinStreak += 1;
  if (profile.currentWinStreak > profile.bestWinStreak) {
    profile.bestWinStreak = profile.currentWinStreak;
  }
  saveProfile();
}
export function recordLoss() {
  profile.losses += 1;
  profile.currentWinStreak = 0;
  saveProfile();
}
export function recordFlip() {
  profile.flips += 1;
  saveProfile();
}

export function getSettings() {
  return settings;
}
export function setSettings(patch) {
  settings = { ...settings, ...patch };
  localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
  return settings;
}

export function getApiUrl() {
  return localStorage.getItem(KEY_API) || ''; // empty = no backend
}
export function setApiUrl(url) {
  if (url) localStorage.setItem(KEY_API, url);
  else localStorage.removeItem(KEY_API);
}
export function getToken() {
  return localStorage.getItem(KEY_TOKEN) || '';
}
export function setToken(t) {
  if (t) localStorage.setItem(KEY_TOKEN, t);
  else localStorage.removeItem(KEY_TOKEN);
}

export function resetProgress() {
  profile = { ...DEFAULT_PROFILE, username: randomUsername() };
  saveProfile();
  setToken('');
}

function saveProfile() {
  localStorage.setItem(KEY_PROFILE, JSON.stringify(profile));
}

function randomUsername() {
  const adj = ['Iron', 'Neon', 'Steel', 'Cyber', 'Mega', 'Turbo', 'Nano', 'Quantum', 'Plasma', 'Rogue', 'Vortex', 'Photon'];
  const noun = ['Bot', 'Crusher', 'Fang', 'Spark', 'Hammer', 'Drift', 'Blaze', 'Wedge', 'Prowler', 'Striker', 'Vortex', 'Atlas'];
  return adj[Math.floor(Math.random() * adj.length)] + noun[Math.floor(Math.random() * noun.length)] + Math.floor(Math.random() * 90 + 10);
}
