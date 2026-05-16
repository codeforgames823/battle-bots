// Guest UUID issuance + Google OAuth placeholder.
import { randomUUID } from 'node:crypto';
import { findUserByGuest, createGuestUser } from './db.js';

const ADJ = ['Iron', 'Neon', 'Steel', 'Cyber', 'Mega', 'Turbo', 'Nano', 'Quantum', 'Plasma', 'Rogue', 'Vortex', 'Photon'];
const NOUN = ['Bot', 'Crusher', 'Fang', 'Spark', 'Hammer', 'Drift', 'Blaze', 'Wedge', 'Prowler', 'Striker', 'Vortex', 'Atlas'];

function randomUsername() {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const b = NOUN[Math.floor(Math.random() * NOUN.length)];
  return a + b + Math.floor(Math.random() * 90 + 10);
}

const VALID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function issueGuest(maybeUuid, maybeUsername) {
  let uuid = (maybeUuid && VALID_UUID.test(maybeUuid)) ? maybeUuid.toLowerCase() : null;
  if (uuid) {
    const existing = await findUserByGuest(uuid);
    if (existing) return existing;
  }
  uuid = uuid || randomUUID();
  const username = sanitizeUsername(maybeUsername) || randomUsername();
  return await createGuestUser(uuid, username);
}

export async function loadByToken(token) {
  if (!token || !VALID_UUID.test(token)) return null;
  return await findUserByGuest(token.toLowerCase());
}

export function sanitizeUsername(name) {
  if (!name) return '';
  const s = String(name).trim().slice(0, 24);
  // Strip control characters, keep printable ASCII + common punctuation
  return s.replace(/[\x00-\x1f\x7f]/g, '').trim();
}

// Google OAuth placeholder — to be implemented in v2.
export async function verifyGoogleToken(_idToken) {
  return null;
}
