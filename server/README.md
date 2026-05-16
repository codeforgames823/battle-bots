# Battle Bots — API + WebSocket

Node/Express + `ws` service that runs matchmaking, authoritative game simulation, and persists profiles/leaderboard to the shared Azure Postgres.

## Endpoints

### REST

- `GET  /health` — readiness (`{status:'ok', db:'ok'}`)
- `POST /api/guest` — issue a guest UUID `{username?}` → `{token, user}`
- `GET  /api/me?token=…` — fetch your profile
- `POST /api/me/username` — change username `{token, username}`
- `POST /api/shop/buy` — buy a bot `{token, botId}`
- `POST /api/garage/active` — set active bot/color `{token, botId, color}`
- `GET  /api/leaderboard` — top 100
- `GET  /api/profile/:id` — public profile

### WebSocket

- `wss://<host>/play?token=<uuid>` — opens a game socket. See [`../CLAUDE.md`](../CLAUDE.md) for the message protocol.

## Local dev

```bash
cd server
cp .env.example .env       # then edit values
npm install
npm run init-db            # creates tables in the configured database
npm run dev                # starts on :8080
```

In your browser console (after loading the static frontend):
```js
localStorage.setItem('bb_api', 'http://localhost:8080')
```
then refresh.

## Schema

See [`schema.sql`](./schema.sql). Tables prefixed `bb_` so they coexist with other apps on the shared Postgres.

## Deploy to Azure Container Apps (zero-downtime, with rollback)

The Dockerfile is ready. This mirrors the workflow used for `hot-dog-tycoon` in the same `AI_Hosting` resource group.

```bash
# 1) Build & push image (use your existing ACR)
az acr build \
  --registry <YOUR_ACR_NAME> \
  --resource-group AI_Hosting \
  --image battle-bots-api:v1 \
  ./server

# 2) Read DB creds from the shared Postgres keyvault
PGHOST=$(az keyvault secret show --vault-name <SHARED_PG_KV> --name pg-host    --query value -o tsv)
PGUSER=$(az keyvault secret show --vault-name <SHARED_PG_KV> --name pg-user    --query value -o tsv)
PGPASS=$(az keyvault secret show --vault-name <SHARED_PG_KV> --name pg-password --query value -o tsv)

# 3) Create the container app (first deploy)
az containerapp create \
  --name battle-bots-api \
  --resource-group AI_Hosting \
  --environment <YOUR_CONTAINERAPP_ENV> \
  --image <YOUR_ACR_NAME>.azurecr.io/battle-bots-api:v1 \
  --registry-server <YOUR_ACR_NAME>.azurecr.io \
  --target-port 8080 \
  --ingress external \
  --transport auto \
  --min-replicas 1 --max-replicas 3 \
  --revision-suffix v1 \
  --secrets pg-password="$PGPASS" \
  --env-vars \
      PGHOST="$PGHOST" \
      PGPORT=5432 \
      PGDATABASE=battle_bots \
      PGUSER="$PGUSER" \
      PGPASSWORD=secretref:pg-password \
      PGSSL=true \
      ALLOWED_ORIGINS="https://YOUR_USERNAME.github.io"

# 4) Subsequent deploys (zero-downtime — second revision created alongside)
az containerapp update \
  --name battle-bots-api \
  --resource-group AI_Hosting \
  --image <YOUR_ACR_NAME>.azurecr.io/battle-bots-api:v2 \
  --revision-suffix v2
```

Container Apps with `--transport auto` natively negotiates WebSocket upgrades — no extra config needed.

After deploy:
1. Run the schema once: `npm run init-db` from a machine with PG access (or psql + schema.sql).
2. Grab the FQDN: `az containerapp show --name battle-bots-api --resource-group AI_Hosting --query properties.configuration.ingress.fqdn -o tsv`
3. Tell the frontend about it in the browser console: `localStorage.setItem('bb_api', 'https://<fqdn>')` then refresh. (We also wire this automatically if `window.BB_API_URL` is set in `index.html` before `main.js`.)

## Rollback (single command)

```bash
az containerapp revision list -n battle-bots-api -g AI_Hosting -o table
az containerapp ingress traffic set -n battle-bots-api -g AI_Hosting \
  --revision-weight <previous-revision-name>=100
```

## Environment variables

| Var | Purpose |
|---|---|
| `PORT` | HTTP port (default 8080) |
| `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD/PGSSL` | Postgres connection |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist |
| `TICK_HZ` | Server simulation rate (default 60) |
| `BROADCAST_HZ` | Client state push rate (default 30) |
| `ROUND_SECONDS` | Length of one round (default 60) |
| `ROUNDS_TO_WIN` | Rounds needed to win match (default 2) |
| `COIN_WIN` / `COIN_LOSS` | Coins awarded per match outcome |
| `GOOGLE_CLIENT_ID` | Optional, OAuth (placeholder) |
