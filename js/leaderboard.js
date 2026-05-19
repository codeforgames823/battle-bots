// Leaderboard client (guest-friendly, modeled on Inca Quest's pattern).
//   getApiUrl() returns the auto-detected base, e.g.
//     https://games-portal.a.justreed.com/battle-bots-api
//   or "" when offline.
//
// Endpoints (server.js):
//   GET  {base}/api/leaderboard?limit=100  →  { leaderboard: [...] }
//   POST {base}/api/leaderboard/submit { name, score, botId?, wins?, mode? }
//                                          →  { ok, rank, name }

import { getApiUrl, getProfile } from './storage.js';

const REQUEST_TIMEOUT_MS = 5000;

async function withTimeout(fetchPromise, ms) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetchPromise(ctrl.signal);
  } finally {
    clearTimeout(to);
  }
}

export async function fetchLeaderboard(limit = 100) {
  const api = getApiUrl();
  if (!api) return { leaderboard: [], offline: true };
  try {
    const res = await withTimeout((signal) =>
      fetch(`${api}/api/leaderboard?limit=${limit}`, { signal, cache: 'no-store' }),
      REQUEST_TIMEOUT_MS
    );
    if (!res.ok) return { leaderboard: [], error: `http_${res.status}` };
    const j = await res.json();
    const rows = Array.isArray(j) ? j : (j.leaderboard || []);
    return { leaderboard: rows, offline: !!j.offline };
  } catch (e) {
    return { leaderboard: [], error: e?.message || 'network' };
  }
}

// Score model: a player's "score" is their lifetime coins (a stable progression
// signal that goes up with wins and shop sells nothing back, so it monotonically
// increases). We also send wins, the current bot, and mode for richer display.
export function computeScore(profile) {
  const p = profile || getProfile();
  // 100 base + 50 per win - 5 per loss, plus current bank. Floor at 0.
  const synthetic = 100 + (p.wins || 0) * 50 - (p.losses || 0) * 5;
  const score = Math.max(0, (p.coins || 0) + Math.max(0, synthetic));
  return score;
}

export async function submitScore({ mode } = {}) {
  const api = getApiUrl();
  const p = getProfile();
  if (!api || !p?.username) return { ok: false, offline: !api };
  const payload = {
    name: p.username,
    score: computeScore(p),
    wins: p.wins || 0,
    botId: p.activeBot || null,
    mode: mode || null,
  };
  try {
    const res = await withTimeout((signal) =>
      fetch(`${api}/api/leaderboard/submit`, {
        signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      REQUEST_TIMEOUT_MS
    );
    if (!res.ok) return { ok: false, error: `http_${res.status}` };
    return await res.json();
  } catch (e) {
    return { ok: false, error: e?.message || 'network' };
  }
}
