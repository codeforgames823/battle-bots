# CLAUDE.md — Battle Bots

This file guides AI assistants working in this repository.

## Project Overview

**Battle Bots** is a real-time online 2-player browser game where each player drives a bot in a side-view arena and tries to flip the opponent upside down (or shove them into the pit). Coins earned from wins buy stronger bots in the shop. Designed for desktop, phone, tablet, and best-effort Apple Watch browser.

## Genre & Differentiator

- **Genre:** competitive arena physics game (think BattleBots TV show, but 2D and online)
- **Hook:** flipping is the *only* win condition. Every bot has a unique flipping or anti-flipping mechanic, so the metagame is rock-paper-scissors with physics.

## Build / Run Commands

```bash
# Frontend (no build step — pure HTML/JS/CSS)
python -m http.server 9091           # serve static files
# open http://localhost:9091

# Backend (only needed for online multiplayer + persistence)
cd server
npm install
cp .env.example .env                 # fill in PG creds
npm run init-db                      # one-time, applies schema.sql
npm run dev                          # node --watch server.js on :8080
```

## Architecture (server-authoritative for online play)

Frontend and backend are independently deployable. Frontend works fully offline (Vs AI). When online, the server runs all physics; clients send inputs and render replicated state.

### Module map — frontend

| File | Purpose |
|------|---------|
| `index.html` | Single-page shell — home screen + game canvas |
| `style.css` | Mobile-first responsive styles (works down to 180px) |
| `js/main.js` | Entry, screen routing |
| `js/home.js` | Home screen UI (hero, mode buttons, tabs) |
| `js/shop.js` | Shop + garage UI |
| `js/game.js` | Game loop, rendering, HUD |
| `js/physics.js` | 2D rigid body physics (shared verbatim with server) |
| `js/bots.js` | Bot definitions, stats, attack hitboxes (shared verbatim with server) |
| `js/ai.js` | Offline AI opponent (3 difficulty levels) |
| `js/controls.js` | Touch joystick, keyboard, optional tilt |
| `js/net.js` | WebSocket client with prediction + reconciliation |
| `js/audio.js` | Procedural music + SFX (Web Audio API) |
| `js/storage.js` | localStorage wrapper, guest UUID, settings |

### Module map — backend

| File | Purpose |
|------|---------|
| `server/server.js` | Express REST + ws upgrade |
| `server/matchmaker.js` | Quick-match queue, friend room codes |
| `server/gameRoom.js` | Per-room authoritative simulation |
| `server/physics.js` | Identical to client physics |
| `server/bots.js` | Identical to client bot defs |
| `server/auth.js` | Guest UUID issuance, optional Google OAuth |
| `server/db.js` | Postgres pool + queries |
| `server/schema.sql` | Tables: `bb_users`, `bb_bots_owned`, `bb_matches` |
| `server/init-db.js` | One-time schema apply |

## REST endpoints

- `GET  /health` — readiness (`{status:'ok', db:'ok'}`)
- `POST /api/guest` — issue a guest UUID; returns `{token, username, coins, bots, activeBot, activeColor}`
- `GET  /api/me?token=…` — fetch current player state
- `POST /api/me/username` — change username (rate-limited)
- `POST /api/shop/buy` — buy a bot `{token, botId}`; server validates coins
- `POST /api/garage/active` — set active bot/color
- `GET  /api/leaderboard` — top 100 by coins
- `GET  /api/profile/:id` — public profile by user id

## WebSocket protocol (`/play?token=<uuid>`)

All messages are JSON. Server is authoritative; client never decides outcomes.

| Direction | `type` | Payload |
|---|---|---|
| C → S | `join` | `{mode:'quick'\|'friend'\|'create', code?, bot, color}` |
| S → C | `joined` | `{roomId, code?, you:{slot}, message?}` |
| S → C | `start` | `{arena, players:[{id, username, bot, color, slot}]}` |
| C → S | `input` | `{t, ax:[-1..1], attack:bool, special:bool}` |
| S → C | `state` | `{t, bots:[{x,y,a,vx,vy,va,hp,charge,flipped}], events:[...]}` |
| S → C | `roundEnd` | `{winnerSlot, score:[w0,w1], reason:'flip'\|'pit'\|'time'}` |
| S → C | `matchEnd` | `{winnerSlot, coinsAwarded, ratingDelta}` |
| C → S | `rematch` | `{}` |

Server simulates at **60 Hz**, broadcasts state at **30 Hz**. Client predicts the local bot at 60 Hz and snaps/blends on reconciliation.

## Anti-cheat rules

1. Client NEVER decides currency, ownership, or hit results.
2. All shop spends validated server-side against current `coins`.
3. Inputs rate-limited (60/sec). Excess gets dropped, not banned.
4. Inputs clamped (`ax ∈ [-1,1]`, attack/special bool only).
5. WebSocket messages capped at 256 bytes.
6. Reconnect grace: 10 sec; otherwise opponent wins by forfeit.

## Key data shapes

### Player record (DB)

```sql
{
  id BIGINT, guest_uuid UUID, google_sub VARCHAR(64),
  username VARCHAR(24), coins BIGINT,
  active_bot VARCHAR(32), active_color VARCHAR(16),
  created_at TIMESTAMPTZ, last_seen TIMESTAMPTZ
}
```

### Bot definition (`bots.js`)

```js
{
  id: 'flipper', name: 'Flipper', tier: 1, price: 500,
  speed: 8, weight: 1.0, armor: 1.0,
  width: 60, height: 18,
  attack: { kind: 'flip', power: 14, range: 35, cooldown: 0.6 },
  special: { kind: 'boost', power: 12, cooldown: 4.0 },
  color: '#ff5577', accent: '#ffaaaa'
}
```

## Roblox / Cursor / Azure conventions

- All `pcall`/`try`/`catch` around DB and external API calls.
- Use `task.spawn`/`fetch` not deprecated APIs.
- Postgres pool capped at 5 (shared DB politeness).
- All secrets through env vars (loaded from KeyVault in prod).
- Container Apps revision-based deploys (`--revision-suffix vN`); rollback via `ingress traffic set`.

## Deployment

- **Frontend**: GitHub Pages (`main` branch, root). CORS-allowed origin: the GH Pages URL.
- **Backend**: Azure Container App `battle-bots-api` in resource group `AI_Hosting`. Image in shared ACR. Secrets in `battle-bots-kv` referencing the shared Postgres KeyVault.
- DB schema: `battle_bots` database on the shared Postgres. Bump `schema.sql` version comment when changes are made; never break old clients silently.

## Conventions

- 2-space indent, single quotes, no semicolons in client JS would be too cute — use semicolons everywhere for consistency with sibling projects.
- All UI text in English; i18n hooks (`t('key')`) reserved for v2 — for now, strings are inline.
- All sizes use `clamp()` and `rem` so the layout reflows from 180px to 4K cleanly.
