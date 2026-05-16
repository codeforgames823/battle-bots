-- Battle Bots schema v1
-- Apply once with `npm run init-db`. Bump the version comment when changes are made.
-- Tables are prefixed `bb_` so they coexist safely on the shared Postgres.

CREATE TABLE IF NOT EXISTS bb_users (
  id            BIGSERIAL    PRIMARY KEY,
  guest_uuid    UUID         UNIQUE,
  google_sub    VARCHAR(64)  UNIQUE,
  username      VARCHAR(24)  NOT NULL,
  coins         BIGINT       NOT NULL DEFAULT 100,
  active_bot    VARCHAR(32)  NOT NULL DEFAULT 'wedge',
  active_color  VARCHAR(16)  NOT NULL DEFAULT '#00eaff',
  wins          INTEGER      NOT NULL DEFAULT 0,
  losses        INTEGER      NOT NULL DEFAULT 0,
  flips_dealt   INTEGER      NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_seen     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bb_bots_owned (
  user_id BIGINT REFERENCES bb_users(id) ON DELETE CASCADE,
  bot_id  VARCHAR(32) NOT NULL,
  bought_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, bot_id)
);

CREATE TABLE IF NOT EXISTS bb_matches (
  id           BIGSERIAL    PRIMARY KEY,
  winner_id    BIGINT       REFERENCES bb_users(id),
  loser_id     BIGINT       REFERENCES bb_users(id),
  winner_bot   VARCHAR(32),
  loser_bot    VARCHAR(32),
  duration_s   INTEGER      NOT NULL,
  rounds_w_w   INTEGER      NOT NULL DEFAULT 0,
  rounds_l_w   INTEGER      NOT NULL DEFAULT 0,
  ended_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bb_users_leaderboard ON bb_users (coins DESC, wins DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_bb_users_lastseen ON bb_users (last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_bb_matches_ended ON bb_matches (ended_at DESC);

-- Seed: a "starter" row for the leaderboard so it's not empty on first deploy.
-- Safe to re-run because of WHERE NOT EXISTS guard.
INSERT INTO bb_users (guest_uuid, username, coins, wins, losses, active_bot, active_color)
SELECT '00000000-0000-0000-0000-000000000001', 'BotZero', 0, 0, 0, 'wedge', '#888888'
WHERE NOT EXISTS (SELECT 1 FROM bb_users WHERE guest_uuid = '00000000-0000-0000-0000-000000000001');
