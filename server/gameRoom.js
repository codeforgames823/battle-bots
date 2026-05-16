// Per-room authoritative game state. Steps physics at TICK_HZ, broadcasts state at BROADCAST_HZ.
// 2 players per room. Best of `ROUNDS_TO_WIN` rounds wins the match.

import { makeBot, makeWorld, step, reset, ARENA, serializeBot } from './physics.js';
import { getBot } from './bots.js';
import * as DB from './db.js';

const TICK_HZ        = Number(process.env.TICK_HZ      || 60);
const BROADCAST_HZ   = Number(process.env.BROADCAST_HZ || 30);
const ROUND_SECONDS  = Number(process.env.ROUND_SECONDS || 60);
const ROUNDS_TO_WIN  = Number(process.env.ROUNDS_TO_WIN || 2);
const COIN_WIN       = Number(process.env.COIN_WIN || 50);
const COIN_LOSS      = Number(process.env.COIN_LOSS || 10);
const MAX_INPUTS_SEC = 90;
const RECONNECT_GRACE_MS = 10_000;
const ROUND_INTERMISSION_MS = 1500;
const COUNTDOWN_S    = 3;

export function makeRoom({ id, code, onClose }) {
  const players = []; // [{ ws, slot, bot, inputs:[], lastInputAt, alive, dcAt }]
  let world = null;
  let phase = 'waiting'; // 'waiting'|'countdown'|'play'|'intermission'|'over'
  let countdownT = COUNTDOWN_S;
  let roundTimer = ROUND_SECONDS;
  let intermissionT = 0;
  let roundsWon = [0, 0];
  let started = false;
  let tickHandle = null;
  let broadcastHandle = null;
  let lastInput = [{ ax: 0, attack: false, special: false }, { ax: 0, attack: false, special: false }];
  let inputBudget = [MAX_INPUTS_SEC, MAX_INPUTS_SEC];
  let lastInputBudgetReset = Date.now();
  let matchStartedAt = 0;
  let closing = false;

  function canJoin() { return players.length < 2 && !closing; }

  function addPlayer(ws) {
    if (players.length >= 2) {
      try { ws.send(JSON.stringify({ type: 'error', message: 'room_full' })); ws.close(); } catch {}
      return;
    }
    const slot = players.length;
    const def = getBot(ws.botId || 'wedge');
    const p = {
      ws,
      slot,
      botId: ws.botId || 'wedge',
      color: ws.color || def.color,
      username: ws.username || `P${slot + 1}`,
      userId: ws.user?.id || null,
      token: ws.token || null,
      alive: true,
      dcAt: 0,
    };
    players.push(p);
    ws.room = exportedApi;
    // Notify room of new arrival
    broadcast({ type: 'roomUpdate', players: players.map((q) => ({
      slot: q.slot, username: q.username, bot: q.botId, color: q.color, id: q.token,
    })) });
  }

  function startMatch() {
    if (started) return;
    if (players.length < 2) return;
    started = true;
    phase = 'countdown';
    countdownT = COUNTDOWN_S;
    matchStartedAt = Date.now();
    buildWorld();
    broadcast({
      type: 'start',
      arena: { halfW: ARENA.halfW, floorY: ARENA.floorY },
      players: players.map((p) => ({
        slot: p.slot, username: p.username, bot: p.botId, color: p.color, id: p.token,
      })),
    });
    if (!tickHandle) tickHandle = setInterval(tick, 1000 / TICK_HZ);
    if (!broadcastHandle) broadcastHandle = setInterval(broadcastState, 1000 / BROADCAST_HZ);
  }

  function buildWorld() {
    world = makeWorld();
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const def = getBot(p.botId);
      const bot = makeBot({
        id: p.token,
        slot: i,
        botDef: def,
        x: i === 0 ? -ARENA.halfW * 0.6 : ARENA.halfW * 0.6,
        y: ARENA.spawnY,
        facing: i === 0 ? 1 : -1,
        color: p.color,
      });
      p.bot = bot;
      world.bots.push(bot);
    }
  }

  function resetForNextRound() {
    if (!world) return;
    for (let i = 0; i < world.bots.length; i++) {
      const bot = world.bots[i];
      reset(bot, i === 0 ? -ARENA.halfW * 0.6 : ARENA.halfW * 0.6, ARENA.spawnY, i === 0 ? 1 : -1);
    }
  }

  // ----- main tick ---------------------------------------------------------
  function tick() {
    if (closing) return;
    const dt = 1 / TICK_HZ;
    // Reset input budget per second
    if (Date.now() - lastInputBudgetReset > 1000) {
      inputBudget[0] = MAX_INPUTS_SEC;
      inputBudget[1] = MAX_INPUTS_SEC;
      lastInputBudgetReset = Date.now();
    }
    // Reconnect grace
    for (const p of players) {
      if (!p.alive && p.dcAt && Date.now() - p.dcAt > RECONNECT_GRACE_MS) {
        // Forfeit
        const winnerSlot = 1 - p.slot;
        endMatch(winnerSlot, 'forfeit');
        return;
      }
    }
    if (phase === 'countdown') {
      countdownT -= dt;
      if (countdownT <= 0) {
        phase = 'play';
        roundTimer = ROUND_SECONDS;
      }
    } else if (phase === 'play') {
      roundTimer -= dt;
      const inputs = [
        players[0]?.alive ? lastInput[0] : { ax: 0, attack: false, special: false },
        players[1]?.alive ? lastInput[1] : { ax: 0, attack: false, special: false },
      ];
      step(world, inputs, dt);
      // Check for flip
      let winnerSlot = -1;
      for (const ev of world.events || []) {
        if (ev.type === 'flip') {
          winnerSlot = 1 - ev.slot;
          break;
        }
      }
      if (winnerSlot < 0 && roundTimer <= 0) {
        // Time-up — highest hp wins, ties → draw round to lower slot
        const a = world.bots[0], b = world.bots[1];
        winnerSlot = (a.hp >= b.hp) ? 0 : 1;
      }
      if (winnerSlot >= 0) endRound(winnerSlot);
    } else if (phase === 'intermission') {
      intermissionT -= dt * 1000;
      if (intermissionT <= 0) {
        // Either start next round or end match
        const winnerOfMatch = roundsWon.findIndex((w) => w >= ROUNDS_TO_WIN);
        if (winnerOfMatch >= 0) {
          endMatch(winnerOfMatch, 'rounds');
        } else {
          phase = 'countdown';
          countdownT = COUNTDOWN_S;
          resetForNextRound();
          broadcast({ type: 'roundStart', round: roundsWon[0] + roundsWon[1] + 1 });
        }
      }
    }
  }

  function endRound(winnerSlot) {
    if (phase !== 'play') return;
    roundsWon[winnerSlot] += 1;
    phase = 'intermission';
    intermissionT = ROUND_INTERMISSION_MS;
    broadcast({ type: 'roundEnd', winnerSlot, score: roundsWon.slice() });
  }

  async function endMatch(winnerSlot, reason) {
    if (phase === 'over') return;
    phase = 'over';
    const winner = players[winnerSlot];
    const loser  = players[1 - winnerSlot];
    let coinsW = COIN_WIN;
    let coinsL = COIN_LOSS;
    try {
      if (winner?.userId) {
        await DB.recordMatch({
          winnerId: winner.userId,
          loserId:  loser?.userId,
          winnerBot: winner.botId,
          loserBot:  loser?.botId,
          durationS: Math.round((Date.now() - matchStartedAt) / 1000),
          roundsWonByWinner: roundsWon[winnerSlot],
          roundsWonByLoser:  roundsWon[1 - winnerSlot],
          coinsWin: coinsW,
          coinsLoss: coinsL,
        });
      }
    } catch (e) {
      console.error('match save failed:', e);
    }
    broadcast({
      type: 'matchEnd',
      winnerSlot,
      reason,
      score: roundsWon.slice(),
      coinsAwarded: { 0: winnerSlot === 0 ? coinsW : coinsL, 1: winnerSlot === 1 ? coinsW : coinsL },
    });
    // Allow rematch within a brief window, then close
    setTimeout(close, 30_000);
  }

  function broadcastState() {
    if (!world || phase === 'waiting' || phase === 'over') return;
    const msg = {
      type: 'state',
      t: world.t,
      phase,
      roundTime: Math.max(0, roundTimer),
      countdown: Math.max(0, countdownT),
      bots: world.bots.map(serializeBot),
      events: (world.events || []).slice(),
    };
    broadcast(msg);
  }

  function broadcast(obj) {
    const json = JSON.stringify(obj);
    for (const p of players) {
      if (p.ws?.readyState === 1) {
        try { p.ws.send(json); } catch {}
      }
    }
  }

  // ----- Client message handler --------------------------------------------
  function handleClientMessage(ws, msg) {
    const p = players.find((q) => q.ws === ws);
    if (!p) return;
    if (msg.type === 'input') {
      if (inputBudget[p.slot] <= 0) return;
      inputBudget[p.slot]--;
      // Sanitize
      lastInput[p.slot] = {
        ax: clamp(Number(msg.ax) || 0, -1, 1),
        attack: !!msg.attack,
        special: !!msg.special,
      };
    } else if (msg.type === 'rematch') {
      // Reset and play again
      if (phase === 'over') {
        roundsWon = [0, 0];
        countdownT = COUNTDOWN_S;
        phase = 'countdown';
        buildWorld();
        broadcast({ type: 'rematchStart', players: players.map((q) => ({
          slot: q.slot, username: q.username, bot: q.botId, color: q.color, id: q.token,
        })) });
      }
    } else if (msg.type === 'leave') {
      try { ws.close(); } catch {}
    }
  }

  function handleDisconnect(ws) {
    const p = players.find((q) => q.ws === ws);
    if (!p) return;
    p.alive = false;
    p.dcAt = Date.now();
    broadcast({ type: 'playerDc', slot: p.slot });
    // If room never started, just close
    if (!started || phase === 'waiting') close();
  }

  function close() {
    if (closing) return;
    closing = true;
    if (tickHandle) clearInterval(tickHandle);
    if (broadcastHandle) clearInterval(broadcastHandle);
    for (const p of players) {
      try { p.ws?.close(); } catch {}
    }
    if (onClose) onClose();
  }

  function shutdown() { close(); }

  const exportedApi = {
    id, code,
    canJoin, addPlayer, startMatch,
    handleClientMessage, handleDisconnect, shutdown,
  };
  return exportedApi;
}

function clamp(v, mn, mx) { return v < mn ? mn : v > mx ? mx : v; }
