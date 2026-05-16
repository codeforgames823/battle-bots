// Garage + Shop renderers. Uses local profile (storage.js) and tries to sync with server (net.js) when online.

import { BOTS, PAINT_COLORS, getBot, drawPortrait } from './bots.js';
import { getProfile, setProfile, ownsBot, addOwnedBot, spendCoins, getApiUrl } from './storage.js';
import { playSfx } from './audio.js';
import { toast } from './controls.js';

let onChange = () => {};
export function setShopChangeHandler(fn) { onChange = fn || (() => {}); }

// ---------------------------------------------------------------------------
// Garage tab — owned bots, set active, paint colors
// ---------------------------------------------------------------------------
export function renderGarage(container) {
  if (!container) return;
  const profile = getProfile();
  container.innerHTML = '';

  // Active bot card (large preview + paint picker)
  const activeWrap = document.createElement('div');
  activeWrap.className = 'profile-card';
  const previewCanvas = document.createElement('canvas');
  previewCanvas.width = 220; previewCanvas.height = 140;
  previewCanvas.style.maxWidth = '100%';
  previewCanvas.style.borderRadius = 'var(--radius-md)';
  drawPortrait(previewCanvas, profile.activeBot, profile.activeColor);

  const meta = document.createElement('div');
  meta.style.display = 'flex';
  meta.style.flexDirection = 'column';
  meta.style.gap = 'var(--pad-sm)';
  const def = getBot(profile.activeBot);
  meta.innerHTML = `
    <div style="font-size:var(--font-lg);font-weight:800">${def.name}</div>
    <div style="color:var(--text-dim);font-size:var(--font-sm)">${def.desc}</div>
    <div class="bot-stats">
      ${statBar('Speed',  def.speed,  12)}
      ${statBar('Power',  def.attack.power, 24)}
      ${statBar('Armor',  def.armor,  1.6)}
      ${statBar('Weight', def.weight, 1.8)}
    </div>
    <div style="margin-top:8px"><strong>Paint:</strong></div>
  `;
  const palette = document.createElement('div');
  palette.className = 'color-picker';
  for (const c of PAINT_COLORS) {
    const sw = document.createElement('button');
    sw.className = 'color-swatch' + (c === profile.activeColor ? ' active' : '');
    sw.style.background = c;
    sw.type = 'button';
    sw.setAttribute('aria-label', `Paint ${c}`);
    sw.addEventListener('click', () => {
      setProfile({ activeColor: c });
      playSfx('click');
      renderGarage(container);
      onChange();
      syncActiveToServer();
    });
    palette.appendChild(sw);
  }
  meta.appendChild(palette);
  activeWrap.appendChild(previewCanvas);
  activeWrap.appendChild(meta);
  container.appendChild(activeWrap);

  // Owned bots grid
  const heading = document.createElement('h3');
  heading.textContent = 'Your Bots';
  heading.style.margin = 'var(--pad-lg) 0 var(--pad-md)';
  heading.style.fontSize = 'var(--font-md)';
  heading.style.color = 'var(--text-dim)';
  container.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'bot-grid';
  for (const id of profile.ownedBots) {
    grid.appendChild(makeOwnedCard(id, profile, container));
  }
  container.appendChild(grid);

  // CTA: Browse the shop
  const cta = document.createElement('div');
  cta.style.marginTop = 'var(--pad-lg)';
  cta.style.textAlign = 'center';
  const lockedCount = BOTS.filter((b) => !ownsBot(b.id)).length;
  if (lockedCount > 0) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary';
    btn.textContent = `Browse Shop (${lockedCount} bots locked)`;
    btn.addEventListener('click', () => {
      document.querySelector('.tab[data-tab="shop"]')?.click();
    });
    cta.appendChild(btn);
  }
  container.appendChild(cta);
}

function makeOwnedCard(id, profile, container) {
  const def = getBot(id);
  const card = document.createElement('div');
  card.className = 'bot-card owned' + (id === profile.activeBot ? ' active' : '');
  const portrait = document.createElement('div');
  portrait.className = 'bot-portrait';
  const cv = document.createElement('canvas');
  cv.width = 200; cv.height = 110;
  drawPortrait(cv, id, id === profile.activeBot ? profile.activeColor : def.color);
  portrait.appendChild(cv);
  const name = document.createElement('div');
  name.className = 'bot-name';
  name.textContent = def.name;
  const tier = document.createElement('div');
  tier.className = 'bot-tier';
  tier.textContent = `Tier ${def.tier}`;
  const actions = document.createElement('div');
  actions.className = 'bot-actions';
  const useBtn = document.createElement('button');
  useBtn.className = 'btn ' + (id === profile.activeBot ? 'btn-ghost' : 'btn-primary');
  useBtn.textContent = id === profile.activeBot ? 'Active' : 'Use';
  useBtn.disabled = id === profile.activeBot;
  useBtn.addEventListener('click', () => {
    setProfile({ activeBot: id });
    playSfx('click');
    renderGarage(container);
    onChange();
    syncActiveToServer();
  });
  actions.appendChild(useBtn);
  card.appendChild(portrait);
  card.appendChild(name);
  card.appendChild(tier);
  card.appendChild(actions);
  return card;
}

// ---------------------------------------------------------------------------
// Shop tab — all bots with prices
// ---------------------------------------------------------------------------
export function renderShop(container) {
  if (!container) return;
  const profile = getProfile();
  container.innerHTML = '';

  const intro = document.createElement('p');
  intro.style.color = 'var(--text-dim)';
  intro.style.fontSize = 'var(--font-sm)';
  intro.style.marginTop = '0';
  intro.textContent = 'Buy stronger bots with coins earned in matches. Each tier brings new attack types and trade-offs.';
  container.appendChild(intro);

  const grid = document.createElement('div');
  grid.className = 'bot-grid';
  for (const def of BOTS) {
    grid.appendChild(makeShopCard(def, profile, container));
  }
  container.appendChild(grid);
}

function makeShopCard(def, profile, container) {
  const owned = ownsBot(def.id);
  const card = document.createElement('div');
  card.className = 'bot-card' + (owned ? ' owned' : ' locked');
  if (owned && def.id === profile.activeBot) card.classList.add('active');

  const portrait = document.createElement('div');
  portrait.className = 'bot-portrait';
  const cv = document.createElement('canvas');
  cv.width = 200; cv.height = 110;
  drawPortrait(cv, def.id, def.color);
  portrait.appendChild(cv);

  const name = document.createElement('div');
  name.className = 'bot-name';
  name.textContent = def.name;

  const tier = document.createElement('div');
  tier.className = 'bot-tier';
  tier.textContent = `Tier ${def.tier} · ${def.desc}`;

  const stats = document.createElement('div');
  stats.className = 'bot-stats';
  stats.innerHTML = `
    ${statBar('Speed',  def.speed,  12)}
    ${statBar('Power',  def.attack.power, 24)}
    ${statBar('Armor',  def.armor,  1.6)}
    ${statBar('Weight', def.weight, 1.8)}
  `;

  const actions = document.createElement('div');
  actions.className = 'bot-actions';
  const buyBtn = document.createElement('button');
  if (owned) {
    buyBtn.className = 'btn btn-secondary';
    buyBtn.textContent = def.id === profile.activeBot ? 'Active' : 'Use';
    buyBtn.disabled = def.id === profile.activeBot;
    buyBtn.addEventListener('click', () => {
      setProfile({ activeBot: def.id });
      playSfx('click');
      renderShop(container);
      onChange();
      syncActiveToServer();
    });
  } else {
    const canAfford = profile.coins >= def.price;
    buyBtn.className = 'btn ' + (canAfford ? 'btn-primary' : 'btn-ghost');
    buyBtn.textContent = `${def.price.toLocaleString()} ¢`;
    buyBtn.disabled = !canAfford;
    buyBtn.addEventListener('click', async () => {
      const result = await tryBuy(def);
      if (result.ok) {
        playSfx('buy');
        toast(`Bought ${def.name}!`);
        renderShop(container);
        onChange();
      } else if (result.reason === 'insufficient_coins') {
        toast('Not enough coins.');
      } else {
        toast(`Purchase failed: ${result.reason}`);
      }
    });
  }
  actions.appendChild(buyBtn);

  card.appendChild(portrait);
  card.appendChild(name);
  card.appendChild(tier);
  card.appendChild(stats);
  card.appendChild(actions);
  return card;
}

async function tryBuy(def) {
  // If backend is reachable, server is authoritative
  const api = getApiUrl();
  const profile = getProfile();
  if (api) {
    try {
      const r = await fetch(`${api}/api/shop/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: localStorage.getItem('bb_token_v1'), botId: def.id }),
      });
      const j = await r.json();
      if (r.ok && j.ok) {
        addOwnedBot(def.id);
        setProfile({ coins: j.coins });
        return { ok: true };
      }
      return { ok: false, reason: j.reason || 'server_error' };
    } catch {
      // Fall through to local
    }
  }
  // Local-only purchase
  if (!spendCoins(def.price)) return { ok: false, reason: 'insufficient_coins' };
  addOwnedBot(def.id);
  return { ok: true };
}

async function syncActiveToServer() {
  const api = getApiUrl();
  if (!api) return;
  try {
    const profile = getProfile();
    await fetch(`${api}/api/garage/active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: localStorage.getItem('bb_token_v1'),
        botId: profile.activeBot,
        color: profile.activeColor,
      }),
    });
  } catch {}
}

function statBar(label, value, max) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  return `
    <div class="bot-stat">
      <span style="min-width:42px;color:var(--text-dim)">${label}</span>
      <div class="bot-stat-bar"><div class="bot-stat-fill" style="width:${pct}%"></div></div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Leaderboard / profile / how-to renderers
// ---------------------------------------------------------------------------

export async function renderLeaderboard(container) {
  if (!container) return;
  container.innerHTML = '<p style="color:var(--text-dim)">Loading…</p>';
  const api = getApiUrl();
  let rows = [];
  if (api) {
    try {
      const r = await fetch(`${api}/api/leaderboard`);
      if (r.ok) rows = await r.json();
    } catch {}
  }
  if (!rows.length) {
    rows = makeLocalLeaderboard();
  }
  container.innerHTML = '';
  if (!api) {
    const note = document.createElement('p');
    note.style.color = 'var(--text-dim)';
    note.style.fontSize = 'var(--font-sm)';
    note.style.marginTop = '0';
    note.textContent = 'Offline mode — showing your local stats. Set the backend URL in the browser console with `localStorage.setItem("bb_api", "https://...")` to see the global board.';
    container.appendChild(note);
  }
  const list = document.createElement('div');
  list.className = 'lb-list';
  rows.forEach((row, i) => {
    const r = document.createElement('div');
    r.className = 'lb-row' + (row.you ? ' you' : '');
    const rank = document.createElement('div');
    rank.className = 'lb-rank' + (i === 0 ? ' gold' : i === 1 ? ' silver' : i === 2 ? ' bronze' : '');
    rank.textContent = '#' + (i + 1);
    const name = document.createElement('div');
    name.className = 'lb-name';
    name.textContent = row.username || 'unnamed';
    const bot = document.createElement('div');
    bot.className = 'lb-bot';
    bot.textContent = getBot(row.active_bot || 'wedge').name;
    const coins = document.createElement('div');
    coins.className = 'lb-coins';
    coins.textContent = (row.coins || 0).toLocaleString() + ' ¢';
    r.appendChild(rank); r.appendChild(name); r.appendChild(bot); r.appendChild(coins);
    list.appendChild(r);
  });
  container.appendChild(list);
}

function makeLocalLeaderboard() {
  const profile = getProfile();
  return [{ username: profile.username, coins: profile.coins, active_bot: profile.activeBot, you: true }];
}

export function renderProfile(container) {
  if (!container) return;
  const profile = getProfile();
  container.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'profile-card';
  const avatar = document.createElement('div');
  avatar.className = 'profile-avatar';
  avatar.textContent = (profile.username[0] || 'B').toUpperCase();
  const right = document.createElement('div');
  right.innerHTML = `
    <div style="font-size:var(--font-lg);font-weight:800">${escapeHtml(profile.username)}</div>
    <div style="color:var(--text-dim);font-size:var(--font-sm)">Joined ${new Date(profile.createdAt).toLocaleDateString()}</div>
  `;
  card.appendChild(avatar);
  card.appendChild(right);
  container.appendChild(card);

  const stats = document.createElement('div');
  stats.className = 'profile-stats';
  const winRate = (profile.wins + profile.losses) > 0 ? Math.round((profile.wins * 100) / (profile.wins + profile.losses)) : 0;
  stats.innerHTML = `
    ${profileStat(profile.wins, 'Wins')}
    ${profileStat(profile.losses, 'Losses')}
    ${profileStat(winRate + '%', 'Win rate')}
    ${profileStat(profile.flips, 'Flips dealt')}
    ${profileStat(profile.bestWinStreak, 'Best streak')}
    ${profileStat(profile.coins.toLocaleString(), 'Coins')}
    ${profileStat(profile.ownedBots.length + '/' + BOTS.length, 'Bots owned')}
  `;
  container.appendChild(stats);
}

function profileStat(value, label) {
  return `<div class="profile-stat"><div class="profile-stat-value">${value}</div><div class="profile-stat-label">${label}</div></div>`;
}

export function renderHowto(container) {
  if (!container) return;
  const steps = [
    { h: 'Drive', p: 'WASD, arrow keys, or the on-screen joystick. The bot turns to face the way you drive.' },
    { h: 'Attack', p: 'Press SPACE or the red ATK button. Each bot has a unique attack — flippers lift, drums spin, hammers smash.' },
    { h: 'Special', p: 'Hold SHIFT or tap the purple SP button when your charge meter is full. Boosts, spins, slams, or shields.' },
    { h: 'Win the round', p: 'Flip the opponent so they lay on their back for one second. Or have more HP when the timer hits zero.' },
    { h: 'Win the match', p: 'First to 2 rounds wins. Earn 50 coins for a win, 10 for a loss.' },
    { h: 'Buy better bots', p: 'Spend coins in the Shop. Higher-tier bots have stronger weapons but very different play styles.' },
  ];
  container.innerHTML = steps.map((s, i) => `
    <div class="howto-step">
      <div class="howto-num">${i + 1}</div>
      <div>
        <h4>${s.h}</h4>
        <p>${s.p}</p>
      </div>
    </div>
  `).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
