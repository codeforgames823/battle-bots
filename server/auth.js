// Guest UUID issuance + Google OAuth placeholder.
import { randomUUID } from 'node:crypto';
import { findUserByGuest, createGuestUser, hasDatabase } from './db.js';

const ADJ = ['Iron', 'Neon', 'Steel', 'Cyber', 'Mega', 'Turbo', 'Nano', 'Quantum', 'Plasma', 'Rogue', 'Vortex', 'Photon'];
const NOUN = ['Bot', 'Crusher', 'Fang', 'Spark', 'Hammer', 'Drift', 'Blaze', 'Wedge', 'Prowler', 'Striker', 'Vortex', 'Atlas'];

function randomUsername() {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const b = NOUN[Math.floor(Math.random() * NOUN.length)];
  return a + b + Math.floor(Math.random() * 90 + 10);
}

const VALID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// In-memory ephemeral users for offline mode (lost on server restart).
const offlineUsers = new Map();
function offlineUser(uuid, username) {
  if (!offlineUsers.has(uuid)) {
    offlineUsers.set(uuid, {
      id: null,
      guest_uuid: uuid,
      username,
      coins: 100,
      active_bot: 'wedge',
      active_color: '#00eaff',
      wins: 0,
      losses: 0,
    });
  }
  return offlineUsers.get(uuid);
}

export async function issueGuest(maybeUuid, maybeUsername) {
  let uuid = (maybeUuid && VALID_UUID.test(maybeUuid)) ? maybeUuid.toLowerCase() : null;
  const username = sanitizeUsername(maybeUsername) || randomUsername();
  if (!hasDatabase()) {
    return offlineUser(uuid || randomUUID(), username);
  }
  if (uuid) {
    const existing = await findUserByGuest(uuid);
    if (existing) return existing;
  }
  uuid = uuid || randomUUID();
  return await createGuestUser(uuid, username);
}

export async function loadByToken(token) {
  if (!token || !VALID_UUID.test(token)) return null;
  if (!hasDatabase()) return offlineUsers.get(token.toLowerCase()) || null;
  return await findUserByGuest(token.toLowerCase());
}

export function sanitizeUsername(name) {
  if (!name) return '';
  // Strip to alphanumeric + space/underscore/dash, cap at 24 chars.
  // Matches Inca Quest's `inca_leaderboard` sanitization for name compatibility.
  const s = String(name).trim().slice(0, 24).replace(/[^a-zA-Z0-9 _-]/g, '').trim();
  return s;
}

// Google OAuth placeholder — to be implemented in v2.
export async function verifyGoogleToken(_idToken) {
  return null;
}
