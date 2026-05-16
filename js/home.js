// Home screen: hero animation, mode selection, tab switching, modals.

import { getProfile, setProfile, getSettings, setSettings, resetProgress, getApiUrl, setApiUrl, setToken, getToken } from './storage.js';
import { renderGarage, renderShop, renderLeaderboard, renderProfile, renderHowto, setShopChangeHandler } from './shop.js';
import { startMatch, showNetOverlay, hideNetOverlay, externalState, externalRoundEnd, externalMatchEnd, refreshSettings } from './game.js';
import { playSfx, applySettings } from './audio.js';
import { toast } from './controls.js';
import { drawBot } from './bots.js';
import { makeBot, makeWorld, ARENA, step, reset as resetBot } from './physics.js';
import { getBot } from './bots.js';
import { openChampionshipModal, closeChampionshipModal } from './championship.js';
import { openTutorial } from './tutorial.js';

let heroAnimRaf = 0;
let heroWorld = null;
let heroLastT = 0;
let heroDir = [1, -1];

let aiDifficulty = 'easy';

export function initHome() {
  // Hero animation
  startHeroAnim();
  // Coin display
  refreshCoins();
  // Mode buttons
  document.getElementById('mode-quick')?.addEventListener('click', onQuickMatch);
  document.getElementById('play-quick-btn')?.addEventListener('click', onPlayPrimary);
  document.getElementById('mode-friend')?.addEventListener('click', () => openModal('modal-friend'));
  const aiCard = document.getElementById('mode-ai');
  aiCard?.addEventListener('click', (e) => {
    if (e.target.closest('.diff-pill')) return;
    onPlayAI();
  });
  aiCard?.addEventListener('keydown', (e) => {
    if (e.target.closest('.diff-pill')) return;
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      onPlayAI();
    }
  });
  document.getElementById('mode-championship')?.addEventListener('click', openChampionshipModal);
  document.getElementById('modal-championship-close')?.addEventListener('click', closeChampionshipModal);
  document.getElementById('modal-championship')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-championship') closeChampionshipModal();
  });
  // Difficulty picker
  for (const pill of document.querySelectorAll('#mode-ai-diff .diff-pill')) {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      aiDifficulty = pill.dataset.diff;
      for (const p of document.querySelectorAll('#mode-ai-diff .diff-pill')) {
        p.classList.toggle('active', p === pill);
      }
    });
  }
  updatePrimaryCta();
  // Settings
  document.getElementById('settings-btn')?.addEventListener('click', () => openSettings());
  document.getElementById('coins-display')?.addEventListener('click', () => {
    document.querySelector('.tab[data-tab="profile"]')?.click();
  });
  // Tabs
  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  }
  // Friend modal
  document.getElementById('friend-create')?.addEventListener('click', onFriendCreate);
  document.getElementById('friend-join')?.addEventListener('click', onFriendJoin);
  document.getElementById('friend-code-input')?.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  });
  document.getElementById('modal-friend-close')?.addEventListener('click', () => closeModal('modal-friend'));
  // Settings modal
  document.getElementById('modal-settings-close')?.addEventListener('click', () => closeModal('modal-settings'));
  document.getElementById('set-username')?.addEventListener('change', (e) => {
    const val = e.target.value.trim().slice(0, 24);
    if (val) {
      setProfile({ username: val });
      syncUsernameToServer(val);
    }
  });
  document.getElementById('set-master')?.addEventListener('input', (e) => {
    setSettings({ master: e.target.value / 100 }); applySettings();
  });
  document.getElementById('set-music')?.addEventListener('input', (e) => {
    setSettings({ music: e.target.value / 100 }); applySettings();
  });
  document.getElementById('set-sfx')?.addEventListener('input', (e) => {
    setSettings({ sfx: e.target.value / 100 }); applySettings(); playSfx('click');
  });
  document.getElementById('set-tilt')?.addEventListener('change', (e) => {
    setSettings({ tilt: e.target.checked });
    if (e.target.checked) requestTiltPermission();
  });
  document.getElementById('set-hifx')?.addEventListener('change', (e) => {
    setSettings({ hifx: e.target.checked });
    refreshSettings();
  });
  document.getElementById('set-reset')?.addEventListener('click', () => {
    if (confirm('Reset progress? This wipes coins and owned bots on this device.')) {
      resetProgress();
      refreshCoins();
      switchTab('garage');
      toast('Progress reset.');
    }
  });
  // Google sign-in placeholder
  document.getElementById('google-signin-btn')?.addEventListener('click', () => {
    toast('Google sign-in coming soon — perks for early Google accounts.');
  });

  // Shop change handler
  setShopChangeHandler(() => {
    refreshCoins();
    if (currentTab === 'garage') renderGarage(document.getElementById('tab-garage'));
    if (currentTab === 'shop')   renderShop(document.getElementById('tab-shop'));
  });

  // Initial tab
  switchTab('garage');

  // Boot guest token from server if API configured
  ensureGuestToken();
}

export function showHome() {
  document.getElementById('game-screen')?.classList.remove('visible');
  document.getElementById('home-screen')?.classList.add('visible');
  refreshCoins();
  if (currentTab) switchTab(currentTab);
}

let currentTab = 'garage';
function switchTab(name) {
  currentTab = name;
  for (const t of document.querySelectorAll('.tab')) {
    t.classList.toggle('active', t.dataset.tab === name);
    t.setAttribute('aria-selected', t.dataset.tab === name ? 'true' : 'false');
  }
  for (const p of document.querySelectorAll('.tab-panel')) {
    p.classList.toggle('active', p.id === 'tab-' + name);
  }
  const container = document.getElementById('tab-' + name);
  if (!container) return;
  container.innerHTML = '';
  if (name === 'garage')      renderGarage(container);
  else if (name === 'shop')   renderShop(container);
  else if (name === 'leaderboard') renderLeaderboard(container);
  else if (name === 'profile')     renderProfile(container);
  else if (name === 'howto')       renderHowto(container);
}

function refreshCoins() {
  const el = document.getElementById('coins-amount');
  if (el) el.textContent = getProfile().coins.toLocaleString();
}

// ============================================================================
// Modals
// ============================================================================
function openModal(id) {
  document.getElementById(id)?.classList.add('visible');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('visible');
}

function openSettings() {
  const profile = getProfile();
  const s = getSettings();
  const u = document.getElementById('set-username'); if (u) u.value = profile.username;
  const m = document.getElementById('set-master'); if (m) m.value = Math.round(s.master * 100);
  const mu = document.getElementById('set-music'); if (mu) mu.value = Math.round(s.music * 100);
  const sx = document.getElementById('set-sfx'); if (sx) sx.value = Math.round(s.sfx * 100);
  const tl = document.getElementById('set-tilt'); if (tl) tl.checked = !!s.tilt;
  const hx = document.getElementById('set-hifx'); if (hx) hx.checked = !!s.hifx;
  openModal('modal-settings');
}

async function requestTiltPermission() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') {
        setSettings({ tilt: false });
        toast('Tilt permission denied.');
      }
    } catch {
      setSettings({ tilt: false });
    }
  }
}

// ============================================================================
// Modes
// ============================================================================

function onPlayAI() {
  const profile = getProfile();
  startMatch({
    mode: 'ai',
    botId: profile.activeBot,
    color: profile.activeColor,
    aiDifficulty,
  });
}

// Big hero PLAY button: prefers online when backend is configured,
// otherwise just kicks off a fast Vs AI match.
function onPlayPrimary() {
  if (getApiUrl()) {
    onQuickMatch();
  } else {
    onPlayAI();
  }
}

function updatePrimaryCta() {
  const btn = document.getElementById('play-quick-btn');
  const sub = document.getElementById('play-quick-sub');
  const online = !!getApiUrl();
  if (btn) btn.textContent = online ? 'PLAY ONLINE' : 'PLAY';
  if (sub) sub.textContent = online ? 'Quick Match · find an opponent' : 'Quick fight vs AI (offline)';
}

async function onQuickMatch() {
  const api = getApiUrl();
  if (!api) {
    onPlayAI();
    return;
  }
  await ensureGuestToken();
  const net = await import('./net.js');
  showNetOverlay('Connecting…', 'Finding an opponent');
  try {
    const handle = await net.connect({ mode: 'quick', botId: getProfile().activeBot, color: getProfile().activeColor });
    handle.onMatchStart = (msg) => {
      hideNetOverlay();
      startMatch({
        mode: 'online',
        botId: getProfile().activeBot,
        color: getProfile().activeColor,
        onlinePlayers: msg.players.map((p, i) => ({
          ...p, slot: i, isLocal: p.id === handle.token, isAI: false,
        })),
        onlineHandle: handle,
        onEnd: () => { /* user handles via overlay */ },
      });
    };
    handle.onState = externalState;
    handle.onRoundEnd = externalRoundEnd;
    handle.onMatchEnd = externalMatchEnd;
    handle.onError = (err) => {
      hideNetOverlay();
      toast('Connection error: ' + (err?.message || err));
    };
    handle.onClose = () => {
      hideNetOverlay();
      toast('Disconnected from server.');
    };
  } catch (e) {
    hideNetOverlay();
    toast('Couldn\'t connect: ' + (e?.message || e));
  }
}

async function onFriendCreate() {
  const api = getApiUrl();
  if (!api) {
    toast('Friend Battle needs a backend. Vs AI works offline.');
    return;
  }
  await ensureGuestToken();
  const net = await import('./net.js');
  try {
    const handle = await net.connect({ mode: 'create', botId: getProfile().activeBot, color: getProfile().activeColor });
    handle.onJoined = (msg) => {
      const code = msg.code || '—';
      const codeEl = document.getElementById('friend-room-code');
      const display = document.getElementById('friend-room-display');
      const status = document.getElementById('friend-room-status');
      if (codeEl) codeEl.textContent = code;
      if (display) display.hidden = false;
      if (status) {
        const link = shareFriendLink(code);
        status.innerHTML = `Waiting for opponent…<br><button class="btn btn-ghost" id="friend-share">Copy share link</button>`;
        status.querySelector('#friend-share')?.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(link);
            toast('Link copied — send it to your friend!');
          } catch {
            prompt('Copy this link:', link);
          }
        });
      }
    };
    handle.onMatchStart = (msg) => {
      closeModal('modal-friend');
      startMatch({
        mode: 'online',
        botId: getProfile().activeBot,
        color: getProfile().activeColor,
        onlinePlayers: msg.players.map((p, i) => ({
          ...p, slot: i, isLocal: p.id === handle.token, isAI: false,
        })),
        onlineHandle: handle,
      });
    };
    handle.onState = externalState;
    handle.onRoundEnd = externalRoundEnd;
    handle.onMatchEnd = externalMatchEnd;
  } catch (e) {
    toast('Couldn\'t create room: ' + (e?.message || e));
  }
}

async function onFriendJoin() {
  const code = (document.getElementById('friend-code-input')?.value || '').trim().toUpperCase();
  if (code.length < 4) { toast('Enter a 5-letter code.'); return; }
  const api = getApiUrl();
  if (!api) { toast('Friend Battle needs a backend.'); return; }
  await ensureGuestToken();
  const net = await import('./net.js');
  try {
    const handle = await net.connect({ mode: 'friend', code, botId: getProfile().activeBot, color: getProfile().activeColor });
    handle.onJoined = () => {
      const status = document.getElementById('friend-room-status');
      if (status) status.textContent = 'Joined! Starting…';
    };
    handle.onMatchStart = (msg) => {
      closeModal('modal-friend');
      startMatch({
        mode: 'online',
        botId: getProfile().activeBot,
        color: getProfile().activeColor,
        onlinePlayers: msg.players.map((p, i) => ({
          ...p, slot: i, isLocal: p.id === handle.token, isAI: false,
        })),
        onlineHandle: handle,
      });
    };
    handle.onState = externalState;
    handle.onRoundEnd = externalRoundEnd;
    handle.onMatchEnd = externalMatchEnd;
    handle.onError = (err) => toast('Error: ' + (err?.message || err));
  } catch (e) {
    toast('Join failed: ' + (e?.message || e));
  }
}

async function ensureGuestToken() {
  const api = getApiUrl();
  if (!api) return;
  let token = getToken();
  try {
    const r = await fetch(`${api}/api/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, username: getProfile().username }),
    });
    if (r.ok) {
      const j = await r.json();
      if (j.token) setToken(j.token);
      if (j.user) {
        setProfile({
          username: j.user.username,
          coins: Number(j.user.coins),
          activeBot: j.user.active_bot,
          activeColor: j.user.active_color,
          ownedBots: Array.isArray(j.user.bots) ? j.user.bots : getProfile().ownedBots,
        });
        refreshCoins();
      }
    }
  } catch {
    // fail silently — local mode still works
  }
}

export function handleDeepLink() {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = (params.get('join') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (code.length >= 4) {
      const input = document.getElementById('friend-code-input');
      if (input) input.value = code;
      openModal('modal-friend');
      if (!getApiUrl()) {
        setTimeout(() => toast('Friend Battle needs an online server. Configure one in Settings → bb_api.'), 1200);
      }
    }
    if (params.get('tutorial') === '1') {
      openTutorial();
    }
  } catch {}
}

export function shareFriendLink(code) {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('join', code);
  return url.toString();
}

async function syncUsernameToServer(username) {
  const api = getApiUrl();
  if (!api) return;
  try {
    await fetch(`${api}/api/me/username`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: getToken(), username }),
    });
  } catch {}
}

// ============================================================================
// Hero animation: two bots ramming each other in the hero canvas
// ============================================================================
function startHeroAnim() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  // Resize handler — keep crisp on hi-DPI
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(40, Math.floor(rect.width * dpr));
    canvas.height = Math.max(40, Math.floor(rect.height * dpr));
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // Build a tiny world with two bots
  heroWorld = makeWorld();
  const a = makeBot({ id: 'h0', slot: 0, botDef: getBot('flipper'), x: -180, y: ARENA.spawnY, facing: 1, color: '#00eaff' });
  const b = makeBot({ id: 'h1', slot: 1, botDef: getBot('drum'),    x:  180, y: ARENA.spawnY, facing: -1, color: '#ff3b8b' });
  heroWorld.bots.push(a, b);
  let scriptT = 0;

  cancelAnimationFrame(heroAnimRaf);
  const tick = (t) => {
    if (!document.getElementById('home-screen')?.classList.contains('visible')) {
      heroAnimRaf = requestAnimationFrame(tick);
      return;
    }
    if (canvas.width === 0 || canvas.height === 0) {
      heroAnimRaf = requestAnimationFrame(tick);
      return;
    }
    const dt = Math.min(0.0333, (t - heroLastT) / 1000 || 0.016);
    heroLastT = t;
    scriptT += dt;
    // Scripted inputs: drive toward each other, attack on contact
    const inputs = [
      { ax: heroDir[0], attack: Math.abs(a.x - b.x) < 90 && Math.random() < 0.05, special: false },
      { ax: heroDir[1], attack: Math.abs(a.x - b.x) < 90 && Math.random() < 0.05, special: false },
    ];
    step(heroWorld, inputs, dt);
    // Reset on flip or off-screen
    if (a.flipped || b.flipped || Math.abs(a.x) > 320 || Math.abs(b.x) > 320 || scriptT > 6) {
      resetBot(a, -180, ARENA.spawnY, 1);
      resetBot(b,  180, ARENA.spawnY, -1);
      heroDir = [1 - Math.random() * 0.2, -1 + Math.random() * 0.2];
      scriptT = 0;
    }
    drawHero(ctx, canvas);
    heroAnimRaf = requestAnimationFrame(tick);
  };
  heroAnimRaf = requestAnimationFrame(tick);
}

function drawHero(ctx, canvas) {
  const W = canvas.width, H = canvas.height;
  // Transparent base so the CSS hero background image shows through
  ctx.clearRect(0, 0, W, H);
  // Subtle vignette for contrast on the bots
  const vGrad = ctx.createRadialGradient(W / 2, H * 0.7, W * 0.2, W / 2, H * 0.7, W * 0.7);
  vGrad.addColorStop(0, 'rgba(0,0,0,0)');
  vGrad.addColorStop(1, 'rgba(10,14,26,0.55)');
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, W, H);
  // Floor neon line
  ctx.save();
  ctx.translate(W / 2, H * 0.78);
  const scale = Math.min(W / 600, H / 220);
  ctx.scale(scale, scale);
  ctx.strokeStyle = 'rgba(0, 234, 255, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-300, 0); ctx.lineTo(300, 0); ctx.stroke();
  // Receding lines
  ctx.strokeStyle = 'rgba(0, 234, 255, 0.16)';
  for (let i = -6; i <= 6; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 50, 0);
    ctx.lineTo(i * 18, -120);
    ctx.stroke();
  }
  // Bots
  for (const bot of heroWorld.bots) {
    drawBot(ctx, bot, { t: heroLastT * 0.001 });
  }
  ctx.restore();
}
