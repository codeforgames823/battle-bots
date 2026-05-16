// Postgres pool + queries.
import pg from 'pg';

const pool = new pg.Pool({
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30_000,
});

pool.on('error', (err) => console.error('Postgres pool error:', err));

export async function ping() {
  await pool.query('SELECT 1');
}

export async function findUserByGuest(uuid) {
  const { rows } = await pool.query(
    'SELECT * FROM bb_users WHERE guest_uuid = $1',
    [uuid]
  );
  return rows[0] || null;
}

export async function createGuestUser(uuid, username) {
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
  const { rows } = await pool.query(
    'SELECT bot_id FROM bb_bots_owned WHERE user_id = $1 ORDER BY bought_at ASC',
    [userId]
  );
  return rows.map((r) => r.bot_id);
}

export async function buyBot(userId, botId, price) {
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
  await pool.query(
    `UPDATE bb_users SET active_bot = $2, active_color = $3, last_seen = NOW()
     WHERE id = $1`,
    [userId, botId, color]
  );
}

export async function setUsername(userId, username) {
  await pool.query(
    `UPDATE bb_users SET username = $2 WHERE id = $1`,
    [userId, username]
  );
}

export async function recordMatch({
  winnerId, loserId, winnerBot, loserBot, durationS, roundsWonByWinner, roundsWonByLoser, coinsWin, coinsLoss,
}) {
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

export async function leaderboard(limit = 100) {
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
  const { rows } = await pool.query(
    `SELECT id, username, coins, wins, losses, flips_dealt, active_bot, active_color, created_at
     FROM bb_users WHERE id = $1`,
    [userId]
  );
  return rows[0] || null;
}

export async function touchLastSeen(userId) {
  await pool.query('UPDATE bb_users SET last_seen = NOW() WHERE id = $1', [userId]);
}

export { pool };
