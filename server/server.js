// Battle Bots — REST + WebSocket server.
// Express handles HTTP. The same HTTP server is upgraded to WebSocket via the `ws` library.
//
// Env vars: see .env.example.
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { URL } from 'node:url';

import * as DB from './db.js';
import { issueGuest, loadByToken, sanitizeUsername } from './auth.js';
import { BOTS, getBot } from './bots.js';
import { makeMatchmaker } from './matchmaker.js';

const {
  PORT = 8080,
  ALLOWED_ORIGINS = '*',
  COIN_WIN = 50,
  COIN_LOSS = 10,
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

app.get('/', (_req, res) => res.json({ name: 'battle-bots-api', status: 'ok' }));

app.get('/health', async (_req, res) => {
  try {
    await DB.ping();
    res.json({ status: 'ok', db: 'ok' });
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

// GET /api/leaderboard
app.get('/api/leaderboard', async (_req, res) => {
  try {
    const rows = await DB.leaderboard(100);
    res.json(rows);
  } catch (e) {
    console.error('leaderboard failed:', e);
    res.status(500).json({ error: 'leaderboard_failed' });
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

server.listen(PORT, () => {
  console.log(`battle-bots-api listening on :${PORT}`);
  console.log(`allowed origins: ${ALLOWED_ORIGINS}`);
});

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
