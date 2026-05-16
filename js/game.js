// Game loop, rendering, HUD, round/match system.
// Supports two modes:
//   - 'ai':     local player vs AI opponent (offline, no backend needed)
//   - 'online': local player vs remote player via net.js (server-authoritative)

import { ARENA, makeBot, makeWorld, step, reset, isFlipped, applyBotState, serializeBot } from './physics.js';
import { getBot, drawBot } from './bots.js';
import { makeAI } from './ai.js';
import { getInput, initControls, setActionCooldownVisuals } from './controls.js';
import { playSfx, startMusic, stopMusic } from './audio.js';
import { getProfile, awardCoins, recordWin, recordLoss, recordFlip, getSettings } from './storage.js';
import { onMatchPlayed } from './achievements.js';

const ROUND_SECONDS = 60;
const ROUNDS_TO_WIN = 2;
const COIN_WIN = 50;
const COIN_LOSS = 10;
// After match ends, ignore rematch clicks for this many ms (prevents double-fire / accidental restart)
const RESULT_LOCKOUT_MS = 700;

let canvas, ctx;
let world = null;
let players = [];        // [{name, botId, color, slot, isLocal, isAI, ai?}]
let mode = 'ai';
let raf = 0;
let lastT = 0;
let running = false;
let paused = false;
let onlineHandle = null; // net.js connection handle when mode==='online'
let countdown = 3;       // pre-round countdown
let roundTime = ROUND_SECONDS;
let roundActive = false;
let roundsWon = [0, 0];
let matchOver = false;
let particles = [];
let cameraShake = 0;
let elapsedSec = 0;       // for rendering animations
let waitingResume = false;

let onMatchEnd = null;    // callback for online integrations
let resultShownAt = 0;    // timestamp result overlay was last shown
let lastAiDifficulty = 'easy';

export function initGame() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  initControls();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  // Pause / resume
  document.getElementById('pause-btn')?.addEventListener('click', togglePause);
  document.getElementById('pause-resume')?.addEventListener('click', () => setPaused(false));
  document.getElementById('pause-quit')?.addEventListener('click', quitToHome);
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && running && !matchOver) togglePause();
  });
  // Result overlay buttons — guarded against accidental rapid-fire after match end
  document.getElementById('result-home')?.addEventListener('click', (e) => {
    if (!isResultClickable()) { e.preventDefault(); return; }
    quitToHome();
  });
  document.getElementById('result-rematch')?.addEventListener('click', (e) => {
    if (!isResultClickable()) { e.preventDefault(); return; }
    if (mode === 'online' && onlineHandle) {
      onlineHandle.requestRematch();
      hide('overlay-result');
    } else if (onMatchEnd) {
      // External (championship) decides next match
      const action = onMatchEnd({ winnerSlot: lastWinnerSlot, reason: lastReason, coinsAwarded: lastCoins, rematchRequested: true });
      hide('overlay-result');
      if (action === 'consumed') return; // championship is handling it
      startMatch({ mode: 'ai', botId: players[0].botId, color: players[0].color, aiDifficulty: lastAiDifficulty });
    } else {
      startMatch({ mode: 'ai', botId: players[0].botId, color: players[0].color, aiDifficulty: lastAiDifficulty });
    }
  });
  document.getElementById('overlay-net-cancel')?.addEventListener('click', () => {
    if (onlineHandle) onlineHandle.disconnect();
    quitToHome();
  });
}

function isResultClickable() {
  return matchOver && (performance.now() - resultShownAt) >= RESULT_LOCKOUT_MS;
}

let lastWinnerSlot = 0;
let lastReason = '';
let lastCoins = 0;

function resizeCanvas() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = Math.floor(window.innerWidth  * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width  = window.innerWidth  + 'px';
  canvas.style.height = window.innerHeight + 'px';
}

export function showGame() {
  try { document.activeElement?.blur?.(); } catch {}
  document.getElementById('home-screen')?.classList.remove('visible');
  document.getElementById('game-screen')?.classList.add('visible');
}
export function hideGame() {
  try { document.activeElement?.blur?.(); } catch {}
  document.getElementById('game-screen')?.classList.remove('visible');
  document.getElementById('home-screen')?.classList.add('visible');
}

// ============================================================================
// Public entry
// ============================================================================

export function startMatch({ mode: m, botId, color, aiDifficulty = 'easy', aiBotId = null, aiName: customAiName = null, aiColor = null, onlinePlayers = null, onlineHandle: handle = null, onEnd = null, label = null }) {
  mode = m;
  matchOver = false;
  roundsWon = [0, 0];
  particles = [];
  cameraShake = 0;
  onMatchEnd = onEnd;
  onlineHandle = handle;
  lastAiDifficulty = aiDifficulty;
  hide('overlay-result');
  hide('overlay-pause');
  hide('overlay-net');

  if (m === 'ai') {
    const aiBot = aiBotId || pickAIBot(botId);
    const aiNm  = customAiName || aiName();
    const aiClr = aiColor || '#ff5577';
    players = [
      { name: getProfile().username || 'YOU', botId, color, slot: 0, isLocal: true,  isAI: false },
      { name: aiNm, botId: aiBot, color: aiClr, slot: 1, isLocal: false, isAI: true, ai: makeAI(aiDifficulty) },
    ];
  } else if (m === 'online') {
    players = onlinePlayers;
  }
  buildWorld();
  showGame();
  startMusic('cyberpunk');
  showHud(label);
  beginRound();
  if (!running) {
    running = true;
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
  }
}

function quitToHome() {
  running = false;
  paused = false;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (onlineHandle) try { onlineHandle.disconnect(); } catch {}
  onlineHandle = null;
  stopMusic();
  hideGame();
  hide('overlay-pause');
  hide('overlay-result');
  hide('overlay-net');
}

function togglePause() {
  if (!running || matchOver || mode === 'online') {
    if (mode === 'online') return; // can't pause online
    return;
  }
  setPaused(!paused);
}

function setPaused(v) {
  paused = v;
  if (v) show('overlay-pause');
  else hide('overlay-pause');
}

// ============================================================================
// World setup
// ============================================================================

function buildWorld() {
  world = makeWorld();
  activeArenaBg = Math.floor(Math.random() * ARENA_BG_URLS.length);
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const botDef = getBot(p.botId);
    const bot = makeBot({
      id: p.id || `slot${i}`,
      slot: i,
      botDef,
      x: i === 0 ? -ARENA.halfW * 0.6 : ARENA.halfW * 0.6,
      y: ARENA.spawnY,
      facing: i === 0 ? 1 : -1,
      color: p.color,
    });
    bot.onAttack = () => playSfx('attack');
    bot.onHit = (mag) => {
      playSfx('bump');
      cameraShake = Math.min(20, cameraShake + mag * 0.05);
    };
    bot.onFlip = () => playSfx('flip');
    world.bots.push(bot);
  }
}

function beginRound() {
  countdown = 3;
  roundTime = ROUND_SECONDS;
  roundActive = false;
  // Reset bots to spawn
  for (let i = 0; i < world.bots.length; i++) {
    const bot = world.bots[i];
    reset(bot, i === 0 ? -ARENA.halfW * 0.6 : ARENA.halfW * 0.6, ARENA.spawnY, i === 0 ? 1 : -1);
  }
  updateHud();
  setStatus(`Round ${roundsWon[0] + roundsWon[1] + 1}`);
  playSfx('roundStart');
}

// ============================================================================
// Main loop
// ============================================================================

function loop(t) {
  raf = requestAnimationFrame(loop);
  if (!running) return;
  let dt = Math.min(0.0333, (t - lastT) / 1000);
  lastT = t;
  if (paused || waitingResume) {
    render();
    return;
  }
  // When match is over, freeze simulation but keep rendering for backdrop
  if (matchOver) {
    cameraShake *= Math.max(0, 1 - dt * 4);
    updateParticles(dt);
    render();
    return;
  }
  elapsedSec += dt;

  if (mode === 'ai') {
    if (!roundActive) {
      countdown -= dt;
      setStatus(countdown > 0 ? Math.ceil(countdown).toString() : 'GO!');
      if (countdown <= -0.5) {
        roundActive = true;
        setStatus('');
      }
    } else {
      const inputs = [];
      const me = world.bots[0];
      const opp = world.bots[1];
      inputs[0] = getInput();
      // AI sees: self=opp (slot 1), opponent=me (slot 0). Wait — args are (self, opponent).
      // The AI controls slot 1. So self=world.bots[1], opponent=world.bots[0].
      inputs[1] = players[1].ai.update(opp, me, dt, performance.now());
      step(world, inputs, dt);
      drainEvents();
      handleRoundProgress(dt);
    }
  } else if (mode === 'online') {
    const ls = localSlot();
    const input = roundActive ? getInput() : { ax: 0, attack: false, special: false };
    onlineHandle?.sendInput(input);
    if (roundActive && world?.bots?.length) {
      const inputs = world.bots.map((_, i) => i === ls ? input : { ax: 0, attack: false, special: false });
      step(world, inputs, dt);
      drainEvents();
    }
  }

  const me = world?.bots?.[localSlot()];
  if (me) setActionCooldownVisuals(me.attackCD, me.specialCD);

  cameraShake *= Math.max(0, 1 - dt * 4);
  updateParticles(dt);
  updateHud();
  render();
}

function drainEvents() {
  if (!world?.events) return;
  for (const ev of world.events) {
    if (ev.type === 'flip') {
      const winnerSlot = 1 - ev.slot;
      if (mode === 'ai') {
        if (winnerSlot === 0) recordFlip();
        endRound(winnerSlot, 'flip');
      }
      // Online: server sends roundEnd authoritatively; client doesn't end on local prediction
    } else if (ev.type === 'flipHit') {
      addParticles(ev.x, ev.y, '#ffd400', 18);
    } else if (ev.type === 'bump') {
      addParticles(ev.x, ev.y, '#ffaa44', 6);
    } else if (ev.type === 'special') {
      addParticles(ev.x, ev.y, '#ff3b8b', 24);
      playSfx('special');
    }
  }
  world.events.length = 0;
}

function handleRoundProgress(dt) {
  if (!roundActive) return;
  roundTime -= dt;
  if (roundTime <= 0 && mode === 'ai') {
    // Time-up: highest hp wins, exact tie goes to player (slot 0) — feels less unfair
    const a = world.bots[0], b = world.bots[1];
    let winner = a.hp >= b.hp ? 0 : 1;
    endRound(winner, 'time');
  }
  if (roundTime <= 10 && roundTime > 9.5) playSfx('tick');
}

function endRound(winnerSlot, reason) {
  if (!roundActive) return;
  roundActive = false;
  roundsWon[winnerSlot] += 1;
  if (winnerSlot === 0) playSfx('win');
  else playSfx('lose');
  if (roundsWon[winnerSlot] >= ROUNDS_TO_WIN) {
    endMatch(winnerSlot, reason);
    return;
  }
  setStatus(`Round to ${players[winnerSlot].name}`);
  setTimeout(() => {
    if (running && !matchOver) beginRound();
  }, 1500);
}

function endMatch(winnerSlot, reason) {
  if (matchOver) return; // guard against double-end
  matchOver = true;
  roundActive = false;
  let coinsAwarded = 0;
  if (mode === 'ai') {
    if (winnerSlot === 0) {
      coinsAwarded = COIN_WIN;
      awardCoins(coinsAwarded);
      recordWin();
    } else {
      coinsAwarded = COIN_LOSS;
      awardCoins(coinsAwarded);
      recordLoss();
    }
  }
  lastWinnerSlot = winnerSlot;
  lastReason = reason;
  lastCoins = coinsAwarded;
  // Defer notification to championship to AFTER overlay is shown,
  // so it can choose to suppress/override the default rematch button.
  showResult(winnerSlot, reason, coinsAwarded);
  try { onMatchPlayed({ won: winnerSlot === 0, reason, opponentBotId: players[1]?.botId, difficulty: lastAiDifficulty }); } catch (e) { console.warn(e); }
  if (onMatchEnd) {
    try { onMatchEnd({ winnerSlot, reason, coinsAwarded, rematchRequested: false }); } catch (e) { console.warn(e); }
  }
}

// Called by net.js when server says round/match ended
export function externalRoundEnd({ winnerSlot, score }) {
  roundsWon = score.slice();
  roundActive = false;
  setStatus(`Round to ${players[winnerSlot]?.name || 'P' + (winnerSlot + 1)}`);
  if (winnerSlot === localSlot()) playSfx('win');
  else playSfx('lose');
  setTimeout(() => {
    if (running && !matchOver) {
      countdown = 3;
      if (world?.bots) for (const bot of world.bots) reset(bot, bot.x, ARENA.spawnY, bot.facing);
    }
  }, 1500);
}

export function externalMatchEnd({ winnerSlot, coinsAwarded, reason }) {
  if (matchOver) return;
  matchOver = true;
  if (winnerSlot === localSlot()) recordWin(); else recordLoss();
  if (coinsAwarded > 0) awardCoins(coinsAwarded);
  lastWinnerSlot = winnerSlot;
  lastReason = reason || 'flip';
  lastCoins = coinsAwarded || 0;
  showResult(winnerSlot, lastReason, lastCoins);
  if (onMatchEnd) onMatchEnd({ winnerSlot, reason: lastReason, coinsAwarded: lastCoins, rematchRequested: false });
}

export function externalState(stateMsg) {
  // {t, bots: [arr,...], events: [...]}
  if (!world) return;
  for (let i = 0; i < world.bots.length; i++) {
    const arr = stateMsg.bots[i];
    if (!arr) continue;
    const localBot = (i === localSlot());
    // Snap remote, blend local
    applyBotState(world.bots[i], arr, localBot ? 0.25 : 1.0);
  }
  if (stateMsg.events) {
    for (const ev of stateMsg.events) {
      if (ev.type === 'flipHit') addParticles(ev.x, ev.y, '#ffd400', 18);
      else if (ev.type === 'bump') addParticles(ev.x, ev.y, '#ffaa44', 6);
      else if (ev.type === 'special') {
        addParticles(ev.x, ev.y, '#ff3b8b', 24);
        playSfx('special');
      } else if (ev.type === 'flip') playSfx('flip');
      else if (ev.type === 'attack') playSfx('attack');
    }
  }
  if (typeof stateMsg.roundTime === 'number') roundTime = stateMsg.roundTime;
  if (stateMsg.phase === 'play') roundActive = true;
}

function localSlot() {
  for (let i = 0; i < players.length; i++) if (players[i]?.isLocal) return i;
  return 0;
}

// ============================================================================
// HUD
// ============================================================================

function showHud(label = null) {
  document.getElementById('hud-name-0').textContent = players[0]?.name || 'YOU';
  document.getElementById('hud-name-1').textContent = players[1]?.name || 'OPP';
  const lbl = document.getElementById('hud-label');
  if (lbl) {
    lbl.textContent = label || '';
    lbl.style.display = label ? 'block' : 'none';
  }
  renderRounds();
}
function setStatus(s) { const el = document.getElementById('hud-status'); if (el) el.textContent = s; }

function updateHud() {
  if (!world) return;
  const a = world.bots[0], b = world.bots[1];
  if (a) {
    const hpPct = Math.max(0, a.hp / a.maxHp);
    const fill = document.getElementById('hud-hp-0');
    if (fill) {
      fill.style.width = (hpPct * 100) + '%';
      fill.classList.toggle('low', hpPct < 0.3);
    }
  }
  if (b) {
    const hpPct = Math.max(0, b.hp / b.maxHp);
    const fill = document.getElementById('hud-hp-1');
    if (fill) {
      fill.style.width = (hpPct * 100) + '%';
      fill.classList.toggle('low', hpPct < 0.3);
    }
  }
  const tEl = document.getElementById('hud-timer');
  if (tEl) {
    tEl.textContent = String(Math.max(0, Math.ceil(roundTime)));
    tEl.classList.toggle('urgent', roundTime <= 10 && roundActive);
  }
}

function renderRounds() {
  for (let s = 0; s < 2; s++) {
    const el = document.getElementById(`hud-rounds-${s}`);
    if (!el) continue;
    el.innerHTML = '';
    for (let i = 0; i < ROUNDS_TO_WIN; i++) {
      const dot = document.createElement('span');
      if (i < roundsWon[s]) dot.classList.add('won');
      el.appendChild(dot);
    }
  }
}

// ============================================================================
// Result overlay
// ============================================================================

function showResult(winnerSlot, reason, coinsAwarded) {
  try { document.activeElement?.blur?.(); } catch {}
  resultShownAt = performance.now();
  const youWon = winnerSlot === localSlot();
  const banner = document.getElementById('result-banner');
  const detail = document.getElementById('result-detail');
  const coins = document.getElementById('result-coins');
  if (banner) {
    banner.textContent = youWon ? 'VICTORY' : 'DEFEAT';
    banner.classList.toggle('defeat', !youWon);
  }
  if (detail) {
    detail.textContent = youWon
      ? (reason === 'time' ? 'You won by HP at time-up!' : 'You flipped the opponent!')
      : (reason === 'time' ? 'Opponent had more HP at time-up.' : 'You got flipped.');
  }
  if (coins) coins.textContent = coinsAwarded ? `+${coinsAwarded} coins` : '';
  show('overlay-result');
  // Customize rematch label when there's an onMatchEnd handler (championship)
  const rematchBtn = document.getElementById('result-rematch');
  if (rematchBtn) {
    rematchBtn.textContent = onMatchEnd ? (youWon ? 'NEXT FIGHT' : 'TRY AGAIN') : 'REMATCH';
  }
}

// ============================================================================
// Render
// ============================================================================

// Lazy-loaded arena backgrounds (optional — falls back to gradient if missing)
const ARENA_BG_URLS = ['img/arenas/warehouse.webp', 'img/arenas/factory.webp', 'img/arenas/lab.webp'];
const arenaBgCache = {};
let activeArenaBg = null;
function getArenaBg(idx) {
  const url = ARENA_BG_URLS[idx % ARENA_BG_URLS.length];
  if (!url) return null;
  if (arenaBgCache[url] === 'failed') return null;
  if (arenaBgCache[url]) return arenaBgCache[url];
  if (arenaBgCache[url] === 'loading') return null;
  arenaBgCache[url] = 'loading';
  const img = new Image();
  img.onload  = () => { arenaBgCache[url] = img; };
  img.onerror = () => { arenaBgCache[url] = 'failed'; };
  img.src = url;
  return null;
}

let hifxCache = null;
let hifxCachedAt = 0;
function hifx() {
  const now = performance.now();
  if (hifxCache === null || now - hifxCachedAt > 1000) {
    hifxCache = getSettings()?.hifx !== false;
    hifxCachedAt = now;
  }
  return hifxCache;
}
export function refreshSettings() { hifxCache = null; }

function render() {
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const fancy = hifx();

  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#0a0e1a');
  bgGrad.addColorStop(1, '#15192e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  if (fancy) {
    const bg = getArenaBg(activeArenaBg ?? 0);
    if (bg && bg.complete) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      const ar = bg.width / bg.height;
      let dw = W, dh = W / ar;
      if (dh < H * 0.7) { dh = H * 0.7; dw = dh * ar; }
      ctx.drawImage(bg, (W - dw) / 2, (H * 0.72) - dh + 60, dw, dh);
      ctx.restore();
    }
  }

  ctx.save();
  ctx.translate(W / 2, H * 0.72);
  const targetW = ARENA.halfW * 2 + 80;
  const targetH = 320;
  const scale = Math.min(W / targetW, H / targetH);
  ctx.scale(scale, scale);
  if (fancy && cameraShake > 0.1) {
    const sx = (Math.random() - 0.5) * cameraShake / scale;
    const sy = (Math.random() - 0.5) * cameraShake / scale;
    ctx.translate(sx, sy);
  }

  if (fancy) drawArenaBg();

  ctx.fillStyle = '#1f2440';
  ctx.fillRect(-ARENA.halfW - 200, 0, ARENA.halfW * 2 + 400, 200);
  ctx.strokeStyle = 'rgba(0, 234, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-ARENA.halfW - 200, 0);
  ctx.lineTo(ARENA.halfW + 200, 0);
  ctx.stroke();
  ctx.fillStyle = '#0e1228';
  ctx.fillRect(-ARENA.halfW - 30, -ARENA.halfW * 0.5, 30, ARENA.halfW * 0.5 + 200);
  ctx.fillRect(ARENA.halfW, -ARENA.halfW * 0.5, 30, ARENA.halfW * 0.5 + 200);
  ctx.strokeStyle = 'rgba(0, 234, 255, 0.6)';
  ctx.beginPath();
  ctx.moveTo(-ARENA.halfW, -ARENA.halfW * 0.5);
  ctx.lineTo(-ARENA.halfW, 0);
  ctx.moveTo(ARENA.halfW, -ARENA.halfW * 0.5);
  ctx.lineTo(ARENA.halfW, 0);
  ctx.stroke();

  if (fancy) drawParticles();

  if (world) {
    for (const bot of world.bots) {
      drawBot(ctx, bot, { t: elapsedSec });
    }
  }

  ctx.restore();
}

function drawArenaBg() {
  // Glowing horizon line + receding grid
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 234, 255, 0.18)';
  ctx.lineWidth = 0.6;
  for (let i = -10; i <= 10; i++) {
    const x = i * 60;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x * 0.3, -200);
    ctx.stroke();
  }
  for (let i = 1; i < 8; i++) {
    const y = -i * 25;
    ctx.beginPath();
    ctx.moveTo(-ARENA.halfW * 0.6, y);
    ctx.lineTo(ARENA.halfW * 0.6, y);
    ctx.stroke();
  }
  // Crowd silhouette
  ctx.fillStyle = 'rgba(40, 50, 90, 0.6)';
  ctx.beginPath();
  for (let x = -ARENA.halfW; x <= ARENA.halfW; x += 12) {
    const h = 18 + ((Math.sin(x * 0.05) + 1) * 6) + ((Math.cos(x * 0.13) + 1) * 4);
    ctx.rect(x, -200 - h, 9, h);
  }
  ctx.fill();
  ctx.restore();
}

function addParticles(x, y, color, n) {
  if (!hifx()) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 240,
      vy: Math.random() * 200 + 40,
      life: 0.5 + Math.random() * 0.4,
      max: 0.9,
      color,
      size: 2 + Math.random() * 2,
    });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vy -= 600 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}
function drawParticles() {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.max);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, -p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ============================================================================
// Helpers
// ============================================================================

function show(id) { document.getElementById(id)?.classList.add('visible'); }
function hide(id) { document.getElementById(id)?.classList.remove('visible'); }

function aiName() {
  const names = ['Sparkbot', 'Flipzilla', 'IronJaw', 'NeonStriker', 'Vortex', 'Razor', 'Atlas', 'Crusher', 'Phantom', 'Drift'];
  return names[Math.floor(Math.random() * names.length)];
}
function pickAIBot(playerBotId) {
  const def = getBot(playerBotId);
  // Pick something from the same tier or one below for fairness
  const tier = def.tier;
  const pool = ['wedge', 'flipper', 'drum', 'lifter', 'hammer', 'tank', 'sawblade', 'mecha'];
  // Find candidates within ±1 tier
  const candidates = pool.filter((id) => Math.abs(getBot(id).tier - tier) <= 1);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Online connection state overlay helpers
export function showNetOverlay(title, sub) {
  const t = document.getElementById('overlay-net-title');
  const s = document.getElementById('overlay-net-sub');
  if (t) t.textContent = title;
  if (s) s.textContent = sub;
  show('overlay-net');
}
export function hideNetOverlay() { hide('overlay-net'); }
