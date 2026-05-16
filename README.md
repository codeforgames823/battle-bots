# Battle Bots

A real-time online 2-player web game where you ram, lift, and **flip the other bot over**. Earn coins, buy stronger bots in the shop, climb the leaderboard.

> **Play it live:** https://codeforgames823.github.io/battle-bots/

## Features

- **Real online 2-player** with matchmaking and 5-character friend codes
- **Vs AI** mode that works fully offline (no backend needed)
- **8 bots to unlock** in the shop, each with unique stats and a special move
- **Polished home screen** with shop, garage, leaderboard, profile, tutorial, settings
- **Mobile-first** — touch controls, virtual joystick, optional tilt steering
- **Responsive down to ~180px** so it renders even on tiny browsers (best-effort Apple Watch via 3rd-party browser apps)
- **Procedural music + SFX** built with the Web Audio API
- **Guest accounts by default** with optional Google sign-in for perks (placeholder, v2)

## Architecture

```
./                  static frontend          GitHub Pages (free, public)
  index.html
  style.css
  js/
  img/

server/             Node.js + Express + ws   Azure Container Apps (AI_Hosting RG)
  server.js                                  shared Azure Postgres (battle_bots DB)
  Dockerfile
```

The frontend works **with or without** the backend:

- **No backend** → Vs AI works perfectly. Online modes show "offline" banner.
- **With backend** → matchmaking, friend rooms, shop persistence, global leaderboard.

## Run locally

```bash
# 1) Frontend (any static server)
python -m http.server 9091
# open http://localhost:9091

# 2) Backend (optional — only for online play and persistence)
cd server
cp .env.example .env       # fill in your Postgres creds
npm install
npm run init-db
npm run dev
# In the browser console:
#   localStorage.setItem('bb_api', 'http://localhost:8080')
# then refresh.
```

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Drive | `WASD` / Arrow keys | Left thumb (virtual joystick) |
| Attack | `Space` | Right thumb (red button) |
| Special | `Shift` | Right thumb (purple button) |
| Pause | `Esc` | Pause icon, top-right |

## Deploying

- **Frontend** → GitHub Pages serves the repo root automatically (Settings → Pages, source: `main` branch, `/` folder).
- **Backend** → see [`server/README.md`](server/README.md) for the Azure Container Apps recipe (zero-downtime via revisions, with rollback instructions).

## Project layout

```
.
├── README.md         ← you are here
├── CLAUDE.md         ← architecture notes for AI assistants
├── index.html        ← static game (deployed to GitHub Pages)
├── style.css
├── js/               ← game + UI logic
├── img/              ← pre-generated copyright-free art
├── scripts/          ← one-off art generation
└── server/           ← realtime API (deploys to Azure Container Apps)
    ├── server.js
    ├── matchmaker.js
    ├── gameRoom.js
    ├── physics.js
    ├── bots.js
    ├── auth.js
    ├── db.js
    ├── schema.sql
    ├── init-db.js
    ├── Dockerfile
    ├── .env.example
    └── README.md
```

## License

MIT — go forth and flip.
