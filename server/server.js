// Battle Bots — REST + WebSocket server.
// Express handles HTTP. The same HTTP server is upgraded to WebSocket via the `ws` library.
// Optionally serves the static frontend from the parent directory so a single
// deploy (e.g. Dokku) hosts both client and API at one URL.
//
// Env vars: see .env.example.
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { URL } from 'node:url';

import * as DB from './db.js';
import { issueGuest, loadByToken, sanitizeUsername } from './auth.js';
import { BOTS, getBot } from './bots.js';
import { makeMatchmaker } from './matchmaker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  PORT = 8080,
  ALLOWED_ORIGINS = '*',
  COIN_WIN = 50,
  COIN_LOSS = 10,
  SERVE_STATIC = '1', // when truthy, also serve ../ as the frontend root
} = process.env;

const allowed = ALLOWED_ORIGINS === '*'
  ? true
  : ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '8kb' }));
app.use(cors({ origin: allowed, methods: ['GET', 'POST', 'PATCH'] }));

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded' },
});

// ---------------------------------------------------------------------------
// REST routes
// ---------------------------------------------------------------------------

// Health endpoint stays JSON even when static frontend is mounted at /.
app.get('/health', async (_req, res) => {
  if (!DB.hasDatabase()) {
    return res.json({ status: 'ok', db: 'offline', uptime: process.uptime() });
  }
  try {
    await DB.ping();
    res.json({ status: 'ok', db: 'ok', uptime: process.uptime() });
  } catch (e) {
    res.status(500).json({ status: 'degraded', db: 'down', error: e.message });
  }
});

// POST /api/guest { token?, username? } → { token, user }
app.post('/api/guest', writeLimiter, async (req, res) => {
  try {
    const { token, username } = req.body || {};
    const user = await issueGuest(token, username);
    const bots = await DB.getOwnedBots(user.id);
    await DB.touchLastSeen(user.id);
    res.json({
      token: user.guest_uuid,
      user: {
        id: user.id,
        username: user.username,
        coins: Number(user.coins),
        active_bot: user.active_bot,
        active_color: user.active_color,
        wins: user.wins,
        losses: user.losses,
        bots,
      },
    });
  } catch (e) {
    console.error('guest failed:', e);
    res.status(500).json({ error: 'Could not create guest' });
  }
});

// GET /api/me?token=…
app.get('/api/me', async (req, res) => {
  const token = String(req.query.token || '');
  const user = await loadByToken(token);
  if (!user) return res.status(401).json({ error: 'invalid_token' });
  const bots = await DB.getOwnedBots(user.id);
  res.json({
    user: {
      id: user.id,
      username: user.username,
      coins: Number(user.coins),
      active_bot: user.active_bot,
      active_color: user.active_color,
      wins: user.wins,
      losses: user.losses,
      bots,
    },
  });
});

// POST /api/me/username { token, username }
app.post('/api/me/username', writeLimiter, async (req, res) => {
  const { token, username } = req.body || {};
  const user = await loadByToken(token);
  if (!user) return res.status(401).json({ error: 'invalid_token' });
  const clean = sanitizeUsername(username);
  if (!clean || clean.length < 2) return res.status(400).json({ error: 'invalid_username' });
  await DB.setUsername(user.id, clean);
  res.json({ ok: true, username: clean });
});

// POST /api/shop/buy { token, botId }
app.post('/api/shop/buy', writeLimiter, async (req, res) => {
  const { token, botId } = req.body || {};
  const user = await loadByToken(token);
  if (!user) return res.status(401).json({ error: 'invalid_token' });
  const def = getBot(botId);
  if (!def || def.id !== botId) return res.status(400).json({ error: 'unknown_bot' });
  const owned = await DB.getOwnedBots(user.id);
  if (owned.includes(botId)) return res.json({ ok: true, alreadyOwned: true, coins: Number(user.coins) });
  const result = await DB.buyBot(user.id, botId, def.price);
  if (!result.ok) return res.json({ ok: false, reason: result.reason });
  res.json({ ok: true, coins: Number(result.coins) });
});

// POST /api/garage/active { token, botId, color }
app.post('/api/garage/active', writeLimiter, async (req, res) => {
  const { token, botId, color } = req.body || {};
  const user = await loadByToken(token);
  if (!user) return res.status(401).json({ error: 'invalid_token' });
  if (!getBot(botId) || getBot(botId).id !== botId) return res.status(400).json({ error: 'unknown_bot' });
  const owned = await DB.getOwnedBots(user.id);
  if (!owned.includes(botId)) return res.status(400).json({ error: 'not_owned' });
  const safeColor = sanitizeColor(color) || '#00eaff';
  await DB.setActive(user.id, botId, safeColor);
  res.json({ ok: true });
});

// GET /api/leaderboard?limit=100 — guest-friendly, modeled on Inca Quest.
// Returns: { leaderboard: [{ name, score, wins, botId, mode }, ...] }
app.get('/api/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const rows = await DB.getGuestLeaderboard(limit);
    res.json({ leaderboard: rows, offline: !DB.hasDatabase() });
  } catch (e) {
    console.error('leaderboard failed:', e);
    res.status(500).json({ error: 'leaderboard_failed', leaderboard: [] });
  }
});

// POST /api/leaderboard/submit { name, score, botId?, wins?, mode? } → { ok, rank, name }
// Guest-friendly: no auth required, name is sanitized to alphanumeric+space.
app.post('/api/leaderboard/submit', writeLimiter, async (req, res) => {
  try {
    const { name, score, botId, wins, mode, token } = req.body || {};
    const rawName = String(name || '').trim();
    const cleanName = sanitizeUsername(rawName) || sanitizeUsername('Player' + Math.floor(Math.random() * 9999));
    const numScore = Number.isFinite(+score) ? Math.max(0, Math.min(1e12, Math.floor(+score))) : 0;
    if (!cleanName || cleanName.length < 1) {
      return res.status(400).json({ error: 'invalid_name' });
    }
    let userId = null;
    if (token) {
      const u = await loadByToken(token);
      if (u) userId = u.id;
    }
    const cleanBot = typeof botId === 'string' && /^[a-z0-9_-]{1,32}$/.test(botId) ? botId : null;
    const cleanMode = ['ai', 'championship', 'online'].includes(mode) ? mode : null;
    const result = await DB.submitGuestScore({
      userId,
      name: cleanName,
      score: numScore,
      botId: cleanBot,
      wins: Number.isFinite(+wins) ? Math.max(0, +wins | 0) : 0,
      mode: cleanMode,
    });
    res.json({ ok: true, ...result, offline: !DB.hasDatabase() });
  } catch (e) {
    console.error('leaderboard submit failed:', e);
    res.status(500).json({ error: 'submit_failed' });
  }
});

// GET /api/profile/:id
app.get('/api/profile/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || id < 1) return res.status(400).json({ error: 'bad_id' });
  const p = await DB.profile(id);
  if (!p) return res.status(404).json({ error: 'not_found' });
  const bots = await DB.getOwnedBots(p.id);
  res.json({ profile: { ...p, coins: Number(p.coins), bots } });
});

// Static catalog of bots (in case the client wants a server-of-truth)
app.get('/api/bots', (_req, res) => {
  res.json(BOTS.map(({ id, name, tier, price, desc, weight, speed, armor, hp }) =>
    ({ id, name, tier, price, desc, weight, speed, armor, hp })));
});

function sanitizeColor(c) {
  if (!c) return null;
  const s = String(c).trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  return null;
}

// ---------------------------------------------------------------------------
// Static frontend (optional — disable by setting SERVE_STATIC=0)
// ---------------------------------------------------------------------------
if (SERVE_STATIC && SERVE_STATIC !== '0' && SERVE_STATIC !== 'false') {
  const staticRoot = path.resolve(__dirname, '..');
  app.use(express.static(staticRoot, { maxAge: '5m', extensions: ['html'] }));
  // SPA fallback for any GET that didn't match API/static and looks like a navigation.
  app.get(/^(?!\/(api|health|play|battle-bots-api)).*/, (req, res, next) => {
    if (req.method !== 'GET' || req.accepts('html') === false) return next();
    res.sendFile(path.join(staticRoot, 'index.html'), (err) => err && next());
  });
  console.log(`[static] serving frontend from ${staticRoot}`);
} else {
  app.get('/', (_req, res) => res.json({ name: 'battle-bots-api', status: 'ok' }));
}

// ---------------------------------------------------------------------------
// HTTP server + WebSocket upgrade
// ---------------------------------------------------------------------------

const server = http.createServer(app);

const wss = new WebSocketServer({ noServer: true });
const matchmaker = makeMatchmaker(wss);

server.on('upgrade', async (req, socket, head) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname !== '/play') {
      socket.destroy();
      return;
    }
    const token = url.searchParams.get('token') || '';
    const user = await loadByToken(token);
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.user = user;
      ws.token = user.guest_uuid;
      matchmaker.handleConnection(ws);
    });
  } catch (e) {
    console.error('upgrade error:', e);
    socket.destroy();
  }
});

(async () => {
  await DB.initSchema();
  server.listen(PORT, () => {
    console.log(`battle-bots-api listening on :${PORT}`);
    console.log(`allowed origins: ${ALLOWED_ORIGINS}`);
    console.log(`database: ${DB.hasDatabase() ? 'connected' : 'OFFLINE (leaderboard/online disabled)'}`);
  });
})();

export { app, server };

// ---------------------------------------------------------------------------
// Graceful shutdown — flush in-flight matches
// ---------------------------------------------------------------------------
let shuttingDown = false;
function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`shutting down: ${reason}`);
  matchmaker.shutdown();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
