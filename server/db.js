// Postgres pool + queries.
// Gracefully degrades to offline mode if no DATABASE_URL is configured
// (mirroring the Inca Quest server pattern).
import pg from 'pg';

const hasDb = !!(process.env.DATABASE_URL || process.env.PGHOST);
const isLocal = (process.env.DATABASE_URL || '').includes('localhost');
const pool = hasDb
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL || undefined,
      ssl: isLocal
        ? false
        : process.env.PGSSL === 'true' || !!process.env.DATABASE_URL
          ? { rejectUnauthorized: false }
          : false,
      max: 5,
      idleTimeoutMillis: 30_000,
    })
  : null;

if (pool) {
  pool.on('error', (err) => console.error('Postgres pool error:', err));
} else {
  console.log('[db] No DATABASE_URL configured — running in offline mode (DB-backed features disabled).');
}

export function hasDatabase() {
  return !!pool;
}

export async function ping() {
  if (!pool) throw new Error('no_database');
  await pool.query('SELECT 1');
}

// Apply schema.sql on startup so a fresh Dokku/Heroku deploy "just works".
// Idempotent — all CREATE TABLE / CREATE INDEX statements use IF NOT EXISTS.
export async function initSchema() {
  if (!pool) return;
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const sql = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');
    await pool.query(sql);
    console.log('[db] schema applied (idempotent).');
  } catch (e) {
    console.error('[db] schema init failed (continuing in degraded mode):', e.message);
  }
}

export async function findUserByGuest(uuid) {
  if (!pool) return null;
  const { rows } = await pool.query(
    'SELECT * FROM bb_users WHERE guest_uuid = $1',
    [uuid]
  );
  return rows[0] || null;
}

export async function createGuestUser(uuid, username) {
  if (!pool) return null;
  const { rows } = await pool.query(
    `INSERT INTO bb_users (guest_uuid, username) VALUES ($1, $2)
     RETURNING *`,
    [uuid, username]
  );
  await pool.query(
    `INSERT INTO bb_bots_owned (user_id, bot_id) VALUES ($1, 'wedge')
     ON CONFLICT DO NOTHING`,
    [rows[0].id]
  );
  return rows[0];
}

export async function getOwnedBots(userId) {
  if (!pool) return ['wedge'];
  const { rows } = await pool.query(
    'SELECT bot_id FROM bb_bots_owned WHERE user_id = $1 ORDER BY bought_at ASC',
    [userId]
  );
  return rows.map((r) => r.bot_id);
}

export async function buyBot(userId, botId, price) {
  if (!pool) return { ok: false, reason: 'no_database' };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const upd = await client.query(
      `UPDATE bb_users SET coins = coins - $2
       WHERE id = $1 AND coins >= $2
       RETURNING coins`,
      [userId, price]
    );
    if (upd.rowCount === 0) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'insufficient_coins' };
    }
    await client.query(
      `INSERT INTO bb_bots_owned (user_id, bot_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, botId]
    );
    await client.query('COMMIT');
    return { ok: true, coins: upd.rows[0].coins };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function setActive(userId, botId, color) {
  if (!pool) return;
  await pool.query(
    `UPDATE bb_users SET active_bot = $2, active_color = $3, last_seen = NOW()
     WHERE id = $1`,
    [userId, botId, color]
  );
}

export async function setUsername(userId, username) {
  if (!pool) return;
  await pool.query(
    `UPDATE bb_users SET username = $2 WHERE id = $1`,
    [userId, username]
  );
}

export async function recordMatch({
  winnerId, loserId, winnerBot, loserBot, durationS, roundsWonByWinner, roundsWonByLoser, coinsWin, coinsLoss,
}) {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (winnerId) {
      await client.query(
        `UPDATE bb_users SET wins = wins + 1, coins = coins + $2, last_seen = NOW()
         WHERE id = $1`,
        [winnerId, coinsWin]
      );
    }
    if (loserId) {
      await client.query(
        `UPDATE bb_users SET losses = losses + 1, coins = coins + $2, last_seen = NOW()
         WHERE id = $1`,
        [loserId, coinsLoss]
      );
    }
    await client.query(
      `INSERT INTO bb_matches (winner_id, loser_id, winner_bot, loser_bot, duration_s, rounds_w_w, rounds_l_w)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [winnerId, loserId, winnerBot, loserBot, durationS, roundsWonByWinner, roundsWonByLoser]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Inca Quest-style guest leaderboard. Append-only writes; group-by-name reads.
// ---------------------------------------------------------------------------

export async function submitGuestScore({ userId, name, score, botId, wins, mode }) {
  if (!pool) return { rank: 0, name, offline: true };
  await pool.query(
    `INSERT INTO bb_leaderboard (user_id, name, score, bot_id, wins, mode)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId || null, name, score, botId || null, wins || 0, mode || null]
  );
  // Rank = 1 + number of distinct names with a higher best score
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int + 1 AS rank
     FROM (
       SELECT name, MAX(score) AS best
       FROM bb_leaderboard
       GROUP BY name
       HAVING MAX(score) > $1
     ) s`,
    [score]
  );
  return { rank: rows[0]?.rank ?? 1, name };
}

export async function getGuestLeaderboard(limit = 100) {
  if (!pool) return [];
  // Best score per name. Ties broken by earliest entry.
  const { rows } = await pool.query(
    `SELECT name,
            MAX(score) AS score,
            MAX(wins)  AS wins,
            (ARRAY_AGG(bot_id ORDER BY score DESC, created_at ASC))[1] AS bot_id,
            (ARRAY_AGG(mode   ORDER BY score DESC, created_at ASC))[1] AS mode,
            MAX(created_at) AS last_played
     FROM bb_leaderboard
     GROUP BY name
     ORDER BY score DESC, last_played ASC
     LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({
    name: r.name,
    score: Number(r.score) || 0,
    wins: Number(r.wins) || 0,
    botId: r.bot_id || null,
    mode: r.mode || null,
  }));
}

// Older /api/leaderboard endpoint (account-based) — keep around for tools.
export async function leaderboard(limit = 100) {
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT id, username, coins, wins, losses, active_bot, active_color
     FROM bb_users
     WHERE wins + losses > 0 OR id = 1
     ORDER BY coins DESC, wins DESC, created_at ASC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function profile(userId) {
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT id, username, coins, wins, losses, flips_dealt, active_bot, active_color, created_at
     FROM bb_users WHERE id = $1`,
    [userId]
  );
  return rows[0] || null;
}

export async function touchLastSeen(userId) {
  if (!pool) return;
  await pool.query('UPDATE bb_users SET last_seen = NOW() WHERE id = $1', [userId]);
}

export { pool };
