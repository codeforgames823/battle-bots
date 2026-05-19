// Garage + Shop renderers. Uses local profile (storage.js) and tries to sync with server (net.js) when online.

import { BOTS, PAINT_COLORS, getBot, drawPortrait } from './bots.js';
import { getProfile, setProfile, ownsBot, addOwnedBot, spendCoins, getApiUrl } from './storage.js';
import { playSfx } from './audio.js';
import { toast } from './controls.js';
import { getUnlocked, ACHIEVEMENTS } from './achievements.js';
import { TIERS as CHAMP_TIERS, isTierWon } from './championship.js';

let onChange = () => {};
export function setShopChangeHandler(fn) { onChange = fn || (() => {}); }

// Try to use the AI-generated portrait image; fall back to canvas drawing.
// Returns a DOM element ready to attach.
function makePortraitElement(botId, paintColor, w = 200, h = 110) {
  const wrap = document.createElement('div');
  wrap.className = 'bot-portrait-wrap';
  wrap.style.position = 'relative';
  wrap.style.width = '100%';
  wrap.style.aspectRatio = `${w} / ${h}`;
  // Always draw canvas as the source-of-truth backdrop (matches the paint color)
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.style.width = '100%';
  cv.style.height = '100%';
  cv.style.borderRadius = 'var(--radius-md)';
  drawPortrait(cv, botId, paintColor);
  wrap.appendChild(cv);
  // Attempt to overlay the AI image
  const img = new Image();
  img.alt = '';
  img.style.position = 'absolute';
  img.style.inset = '0';
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.objectFit = 'cover';
  img.style.borderRadius = 'var(--radius-md)';
  img.style.opacity = '0';
  img.style.transition = 'opacity 350ms ease';
  img.style.mixBlendMode = 'screen';
  img.onload = () => { img.style.opacity = '0.55'; };
  img.onerror = () => { img.remove(); };
  img.src = `img/bots/${botId}.webp`;
  wrap.appendChild(img);
  return wrap;
}

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
  portrait.appendChild(makePortraitElement(id, id === profile.activeBot ? profile.activeColor : def.color));
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
  portrait.appendChild(makePortraitElement(def.id, def.color));

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
  const { fetchLeaderboard, submitScore, computeScore } = await import('./leaderboard.js');
  const profile = getProfile();
  const myScore = computeScore(profile);

  const hasApi = !!getApiUrl();
  // If we're online, opportunistically post our score so we appear on the board.
  if (hasApi) submitScore({ mode: 'browse' });

  const { leaderboard: rows, offline: dbOffline, error } = await fetchLeaderboard(100);

  container.innerHTML = '';

  // Three states: (1) no API at all, (2) API reachable but no rows yet, (3) network error
  if (!hasApi) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-icon">📡</div>
      <h3>Offline mode</h3>
      <p>The online server isn't reachable right now. Showing your local stats below — they'll be synced when the backend is connected.</p>
    `;
    container.appendChild(empty);
    rows.push(...makeLocalLeaderboard(profile, myScore));
  } else if (error) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-icon">⚠️</div>
      <h3>Couldn't reach the leaderboard</h3>
      <p>${escapeHtml(error)}. Try again in a moment.</p>
    `;
    container.appendChild(empty);
    rows.push(...makeLocalLeaderboard(profile, myScore));
  } else if (rows.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    if (dbOffline) {
      empty.innerHTML = `
        <div class="empty-icon">🗄️</div>
        <h3>Database warming up</h3>
        <p>The server is online but the leaderboard storage isn't connected yet. Showing your local stats.</p>
      `;
    } else {
      empty.innerHTML = `
        <div class="empty-icon">🏆</div>
        <h3>Leaderboard is empty</h3>
        <p>Be the first! Win a match to claim the #1 spot.</p>
      `;
    }
    container.appendChild(empty);
    rows.push(...makeLocalLeaderboard(profile, myScore));
  }

  const list = document.createElement('div');
  list.className = 'lb-list';
  const myName = (profile.username || '').toLowerCase();
  rows.forEach((row, i) => {
    const r = document.createElement('div');
    const isMe = !!row.you || (row.name && row.name.toLowerCase() === myName);
    r.className = 'lb-row' + (isMe ? ' you' : '');
    const rank = document.createElement('div');
    rank.className = 'lb-rank' + (i === 0 ? ' gold' : i === 1 ? ' silver' : i === 2 ? ' bronze' : '');
    rank.textContent = '#' + (i + 1);
    const name = document.createElement('div');
    name.className = 'lb-name';
    name.textContent = row.name || row.username || 'unnamed';
    const bot = document.createElement('div');
    bot.className = 'lb-bot';
    const botId = row.botId || row.active_bot || 'wedge';
    bot.textContent = getBot(botId).name;
    const score = document.createElement('div');
    score.className = 'lb-coins';
    const value = (row.score != null) ? row.score : (row.coins || 0);
    score.textContent = (+value || 0).toLocaleString() + ' pts';
    r.appendChild(rank); r.appendChild(name); r.appendChild(bot); r.appendChild(score);
    list.appendChild(r);
  });
  container.appendChild(list);
}

function makeLocalLeaderboard(profile, myScore) {
  const rows = [{ name: profile.username, score: myScore, botId: profile.activeBot, you: true }];
  if (profile.wins + profile.losses >= 1) {
    rows.push(
      { name: 'Sparkbot',  score: Math.max(80,  Math.floor(myScore * 0.8)), botId: 'flipper' },
      { name: 'IronJaw',   score: Math.max(50,  Math.floor(myScore * 0.55)), botId: 'drum' },
      { name: 'Phantom',   score: Math.max(20,  Math.floor(myScore * 0.3)), botId: 'wedge' },
    );
    rows.sort((a, b) => (b.score || 0) - (a.score || 0));
  }
  return rows;
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

  const totalMatches = profile.wins + profile.losses;
  if (totalMatches === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state empty-state-inline';
    empty.innerHTML = `
      <div class="empty-icon">🤖</div>
      <h3>No matches yet</h3>
      <p>Play your first match to start earning coins and tracking stats. Try <strong>Vs AI</strong> on Easy to learn the controls.</p>
    `;
    container.appendChild(empty);
  }

  const stats = document.createElement('div');
  stats.className = 'profile-stats';
  const winRate = totalMatches > 0 ? Math.round((profile.wins * 100) / totalMatches) : 0;
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

  // Trophy case
  const trophyHeader = document.createElement('h3');
  trophyHeader.textContent = 'Trophies';
  trophyHeader.className = 'profile-section-title';
  container.appendChild(trophyHeader);
  const trophyRow = document.createElement('div');
  trophyRow.className = 'trophy-row';
  for (const tier of CHAMP_TIERS) {
    const won = isTierWon(tier.id);
    const t = document.createElement('div');
    t.className = 'trophy' + (won ? ' won' : ' locked');
    t.style.setProperty('--tier-color', tier.color);
    t.innerHTML = `
      <div class="trophy-icon">${won ? tier.icon : '🔒'}</div>
      <div class="trophy-name">${tier.name}</div>
    `;
    trophyRow.appendChild(t);
  }
  container.appendChild(trophyRow);

  // Achievements
  const achHeader = document.createElement('h3');
  const unlocked = getUnlocked();
  const unlockCount = unlocked.filter((a) => a.unlocked).length;
  achHeader.textContent = `Achievements (${unlockCount}/${ACHIEVEMENTS.length})`;
  achHeader.className = 'profile-section-title';
  container.appendChild(achHeader);
  const achGrid = document.createElement('div');
  achGrid.className = 'ach-grid';
  for (const a of unlocked) {
    const el = document.createElement('div');
    el.className = 'ach' + (a.unlocked ? ' unlocked' : ' locked');
    el.title = a.desc;
    el.innerHTML = `
      <div class="ach-icon">${a.unlocked ? a.icon : '🔒'}</div>
      <div class="ach-info">
        <div class="ach-name">${a.name}</div>
        <div class="ach-desc">${a.desc}</div>
        ${a.unlocked ? '' : `<div class="ach-reward">+${a.reward}¢</div>`}
      </div>
    `;
    achGrid.appendChild(el);
  }
  container.appendChild(achGrid);
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
