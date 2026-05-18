// Battle Bots — bot definitions, stats, attack/special config, render hints.
// Shared verbatim between client (js/bots.js) and server (server/bots.js).
//
// `attack.kind`  : 'flip' | 'drum' | 'hammer' | 'lift' | 'saw' | 'crush'
// `special.kind` : 'boost' | 'slam' | 'spin'  | 'shield'

export const BOTS = [
  {
    id: 'wedge',
    name: 'Wedge',
    tier: 0,
    price: 0,
    desc: 'A balanced starter bot with a low front ramp. Easy to drive, hard to flip.',
    weight: 1.0,
    width: 70,
    height: 18,
    speed: 9,
    armor: 1.0,
    hp: 100,
    color: '#00eaff',
    accent: '#005f6b',
    attack: { kind: 'flip', power: 8, range: 30, cooldown: 0.5 },
    special: { kind: 'boost', power: 6, cooldown: 5 },
    art: { wedge: 0.5, top: 'flat', wheel: 'standard' },
  },
  {
    id: 'flipper',
    name: 'Flipper',
    tier: 1,
    price: 500,
    desc: 'Pneumatic flip arm. The classic answer to "how do I flip an opponent?"',
    weight: 1.05,
    width: 72,
    height: 20,
    speed: 9,
    armor: 1.0,
    hp: 100,
    color: '#ff5577',
    accent: '#5a1530',
    attack: { kind: 'flip', power: 14, range: 38, cooldown: 0.65 },
    special: { kind: 'boost', power: 9, cooldown: 4 },
    art: { wedge: 0.4, top: 'arm', wheel: 'standard' },
  },
  {
    id: 'drum',
    name: 'Drum',
    tier: 2,
    price: 1500,
    desc: 'Spinning front drum sends opponents flying upward on contact.',
    weight: 1.15,
    width: 78,
    height: 26,
    speed: 8,
    armor: 1.05,
    hp: 110,
    color: '#ffd400',
    accent: '#5a4500',
    attack: { kind: 'drum', power: 12, range: 36, cooldown: 0.45 },
    special: { kind: 'spin', power: 8, cooldown: 6 },
    art: { wedge: 0.2, top: 'flat', wheel: 'thick', drum: true },
  },
  {
    id: 'lifter',
    name: 'Lifter',
    tier: 3,
    price: 3000,
    desc: 'Slow but powerful arm that lifts and tips opponents over.',
    weight: 1.25,
    width: 76,
    height: 22,
    speed: 7,
    armor: 1.1,
    hp: 120,
    color: '#4ade80',
    accent: '#0f5132',
    attack: { kind: 'lift', power: 18, range: 42, cooldown: 0.9 },
    special: { kind: 'shield', power: 5, cooldown: 7 },
    art: { wedge: 0.35, top: 'forks', wheel: 'standard' },
  },
  {
    id: 'hammer',
    name: 'Hammer',
    tier: 4,
    price: 5000,
    desc: 'Top-mounted hammer crashes down for huge angular impact.',
    weight: 1.4,
    width: 70,
    height: 30,
    speed: 6,
    armor: 1.15,
    hp: 130,
    color: '#a855f7',
    accent: '#3b0764',
    attack: { kind: 'hammer', power: 20, range: 30, cooldown: 1.0 },
    special: { kind: 'slam', power: 9, cooldown: 8 },
    art: { wedge: 0.3, top: 'hammer', wheel: 'standard' },
  },
  {
    id: 'tank',
    name: 'Tank',
    tier: 5,
    price: 8000,
    desc: 'Heavy treads, low center of mass. Almost impossible to flip.',
    weight: 1.7,
    width: 84,
    height: 24,
    speed: 5,
    armor: 1.5,
    hp: 160,
    color: '#888888',
    accent: '#2a2a2a',
    attack: { kind: 'flip', power: 12, range: 32, cooldown: 0.6 },
    special: { kind: 'shield', power: 7, cooldown: 6 },
    art: { wedge: 0.5, top: 'flat', wheel: 'tread' },
  },
  {
    id: 'sawblade',
    name: 'Sawblade',
    tier: 6,
    price: 12000,
    desc: 'Fast horizontal spinner. Wears down armor while staying mobile.',
    weight: 1.1,
    width: 72,
    height: 22,
    speed: 11,
    armor: 0.95,
    hp: 105,
    color: '#ff8800',
    accent: '#5c2700',
    attack: { kind: 'saw', power: 16, range: 44, cooldown: 0.4 },
    special: { kind: 'spin', power: 11, cooldown: 5 },
    art: { wedge: 0.3, top: 'flat', wheel: 'standard', saw: true },
  },
  {
    id: 'mecha',
    name: 'Mecha',
    tier: 7,
    price: 25000,
    desc: 'Premium endgame bot. Fast, heavy, devastating slam attack.',
    weight: 1.5,
    width: 80,
    height: 28,
    speed: 10,
    armor: 1.3,
    hp: 150,
    color: '#ff3b8b',
    accent: '#5c0028',
    attack: { kind: 'crush', power: 22, range: 40, cooldown: 0.7 },
    special: { kind: 'slam', power: 13, cooldown: 6 },
    art: { wedge: 0.35, top: 'crusher', wheel: 'mech' },
  },
];

export const BOT_BY_ID = Object.fromEntries(BOTS.map((b) => [b.id, b]));

export function getBot(id) {
  return BOT_BY_ID[id] || BOTS[0];
}

export const PAINT_COLORS = [
  '#00eaff', // cyan
  '#ff5577', // hot pink
  '#ffd400', // gold
  '#4ade80', // green
  '#a855f7', // purple
  '#ff8800', // orange
  '#ffffff', // white
  '#888888', // grey
  '#ff3b8b', // magenta
  '#5577ff', // blue
];

// Shared rendering helper — draws a single bot oriented in world space.
// Caller is responsible for transforming the camera. `ctx` is a 2D canvas context.
export function drawBot(ctx, bot, opts = {}) {
  const def = bot.botDef || getBot(bot.id || 'wedge');
  const color = bot.color || def.color;
  const accent = def.accent;
  const w = def.width;
  const h = def.height;
  const facing = bot.facing || 1;
  const t = opts.t || 0;
  const attackPulse = clamp01((bot.attackVis || 0) / 0.18);
  const specialPulse = clamp01((bot.specialVis || 0) / 0.3);
  const vx = bot.vx || 0;
  const wedge = def.art?.wedge ?? 0.4;

  ctx.save();
  ctx.translate(bot.x, -bot.y);
  ctx.rotate(-bot.a);
  ctx.scale(facing, 1);

  // ---- Soft shadow under the bot
  if (opts.shadow !== false && bot.onGround !== false) {
    ctx.save();
    const sa = 0.32 - Math.min(0.18, Math.abs(bot.vy || 0) * 0.0008);
    ctx.globalAlpha = Math.max(0.06, sa);
    const grad = ctx.createRadialGradient(0, h * 0.65, 2, 0, h * 0.65, w * 0.65);
    grad.addColorStop(0, '#000');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.65, w * 0.6, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---- "Special ready" gold ring around the bot
  const cmReady = (bot.chargeMeter || 0) >= 0.99;
  if (cmReady && opts.showCharge !== false) {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 5);
    ctx.strokeStyle = '#ffd400';
    ctx.shadowColor = '#ffd400';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.62, h * 0.95, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ---- Neon underglow halo (the "cool" factor)
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 18 + specialPulse * 24 + attackPulse * 16;
  ctx.fillStyle = 'rgba(0,0,0,0.01)'; // near-invisible body, just for the shadow stamp
  bodyPath(ctx, w, h, wedge);
  ctx.fill();
  ctx.restore();

  // ---- Wheels / treads
  const wheelKind = def.art?.wheel || 'standard';
  if (wheelKind === 'tread')      drawTreads(ctx, w, h, accent, color, t, vx);
  else                            drawWheels(ctx, w, h, accent, color, t, vx, wheelKind);

  // ---- Body
  drawBody(ctx, w, h, wedge, color, accent);

  // ---- Battle damage (scratches, scorch, sparks) — based on current HP
  if (bot.hp != null && def.hp) {
    drawDamage(ctx, w, h, wedge, clamp01(bot.hp / def.hp));
  }

  // ---- Top weapon
  drawTop(ctx, w, h, def.art?.top || 'flat', accent, color, attackPulse, t);

  // ---- Front spinners
  if (def.art?.drum) drawDrum(ctx, w, h, accent, color, t, attackPulse);
  if (def.art?.saw)  drawSaw(ctx, w, h, accent, color, t, attackPulse);

  // ---- Cockpit / eye
  drawCockpit(ctx, w, h, color, accent, t, def.tier ?? 0);

  // ---- Attack flash (white pulse over body)
  if (attackPulse > 0) {
    ctx.save();
    ctx.globalAlpha = attackPulse * 0.6;
    ctx.globalCompositeOperation = 'lighter';
    bodyPath(ctx, w, h, wedge);
    const flashGrad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    flashGrad.addColorStop(0, 'rgba(255,255,255,0)');
    flashGrad.addColorStop(1, 'rgba(255,255,255,0.9)');
    ctx.fillStyle = flashGrad;
    ctx.fill();
    ctx.restore();
  }

  // ---- Movement spark trail from rear (when moving fast)
  if (opts.shadow !== false && Math.abs(vx) > 2.5) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    const dir = vx > 0 ? -1 : 1;
    for (let i = 0; i < 2; i++) {
      const offset = 4 + i * 6;
      ctx.beginPath();
      ctx.arc(dir * (w / 2 + offset), h / 2 - 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---- Charge meter (thin bar above the bot — subtle until ready)
  if ((bot.chargeMeter || 0) > 0.05 && opts.showCharge !== false) {
    ctx.save();
    ctx.scale(facing, 1);
    const cm = bot.chargeMeter;
    const ready = cm >= 0.99;
    const meterY = -h * 0.9 - 10;
    const meterW = w * 0.55;
    const meterColor = ready ? '#ffd400' : '#00eaff';
    ctx.strokeStyle = meterColor;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.globalAlpha = ready ? 0.55 + 0.25 * Math.sin(t * 6) : 0.35 + cm * 0.45;
    ctx.shadowColor = meterColor;
    ctx.shadowBlur = ready ? 5 : 2;
    ctx.beginPath();
    ctx.moveTo(-meterW / 2, meterY);
    ctx.lineTo(-meterW / 2 + meterW * cm, meterY);
    ctx.stroke();
    ctx.restore();
  }

  // ---- Flipped indicator (turtle SOS)
  if (bot.flipped) {
    ctx.save();
    ctx.scale(facing, 1);
    ctx.fillStyle = '#ff4d6d';
    ctx.shadowColor = '#ff4d6d';
    ctx.shadowBlur = 10;
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -h * 0.7);
    ctx.restore();
  }

  ctx.restore();
}

// ===========================================================================
// Body
// ===========================================================================

function bodyPath(ctx, w, h, wedge) {
  const hw = w / 2, hh = h / 2;
  const wo = wedge * h;
  ctx.beginPath();
  ctx.moveTo(-hw,  hh);
  ctx.lineTo( hw - wo, hh);
  ctx.lineTo( hw, hh - wo);
  ctx.lineTo( hw, -hh + Math.min(4, wo * 0.4));
  ctx.lineTo( hw - 3, -hh);
  ctx.lineTo(-hw + 3, -hh);
  ctx.lineTo(-hw, -hh + 4);
  ctx.closePath();
}

function drawBody(ctx, w, h, wedge, color, accent) {
  const hw = w / 2, hh = h / 2;
  const wo = wedge * h;

  // Main shape with vertical gradient
  bodyPath(ctx, w, h, wedge);
  const grad = ctx.createLinearGradient(0, -hh, 0, hh);
  grad.addColorStop(0,    lighten(color, 0.30));
  grad.addColorStop(0.45, color);
  grad.addColorStop(1,    accent);
  ctx.fillStyle = grad;
  ctx.fill();

  // Outline
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Top reflective highlight strip
  ctx.beginPath();
  ctx.moveTo(-hw + 5, -hh + 3);
  ctx.lineTo( hw - 6, -hh + 3);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Wedge front edge highlight (the sharp line)
  ctx.beginPath();
  ctx.moveTo(hw - wo, hh);
  ctx.lineTo(hw, hh - wo);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Panel divisions
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.8;
  for (let i = 1; i <= 3; i++) {
    const x = -hw + (w / 4) * i;
    if (x > hw - wo - 2) continue;
    ctx.beginPath();
    ctx.moveTo(x, -hh + 5);
    ctx.lineTo(x,  hh - 2);
    ctx.stroke();
  }

  // Corner bolts
  drawBolt(ctx, -hw + 4, -hh + 5);
  drawBolt(ctx, -hw + 4,  hh - 3);
  drawBolt(ctx,  hw - wo - 4,  hh - 3);
  drawBolt(ctx, -hw + w * 0.25, -hh + 5);
  drawBolt(ctx, -hw + w * 0.5,  -hh + 5);

  // Rear vent slashes
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) {
    const sx = -hw + 7 + i * 4;
    ctx.beginPath();
    ctx.moveTo(sx, -hh + 9);
    ctx.lineTo(sx - 2, hh - 5);
    ctx.stroke();
  }
}

function drawDamage(ctx, w, h, wedge, hpRatio) {
  // Scratches/cracks fade in as HP drops. 1.0 = pristine, 0 = wrecked.
  if (hpRatio >= 0.85) return;
  const hw = w / 2, hh = h / 2;
  ctx.save();
  bodyPath(ctx, w, h, wedge);
  ctx.clip();
  const damage = 1 - hpRatio; // 0 to 1
  // Scratch lines
  ctx.strokeStyle = `rgba(0,0,0,${Math.min(0.85, damage * 1.2)})`;
  ctx.lineWidth = 1.1;
  // Deterministic-ish scratches based on bot dims
  const seeds = [0.21, 0.47, 0.73, 0.13, 0.61, 0.92, 0.37];
  const count = damage > 0.5 ? 5 : damage > 0.3 ? 3 : 2;
  for (let i = 0; i < count; i++) {
    const sy = (seeds[i] - 0.5) * (h - 6);
    const sx0 = (seeds[(i + 2) % seeds.length] - 0.5) * (w - 12);
    const len = 8 + seeds[(i + 3) % seeds.length] * 18;
    ctx.beginPath();
    ctx.moveTo(sx0, sy);
    ctx.lineTo(sx0 + len, sy + (seeds[(i + 4) % seeds.length] - 0.5) * 4);
    ctx.stroke();
  }
  // Scorch patches when seriously hurt
  if (damage > 0.5) {
    ctx.fillStyle = `rgba(20,10,5,${Math.min(0.55, (damage - 0.5) * 1.4)})`;
    for (let i = 0; i < 2; i++) {
      const cx = (seeds[i] - 0.5) * (w - 16);
      const cy = (seeds[(i + 1) % seeds.length] - 0.5) * (h - 6);
      ctx.beginPath();
      ctx.ellipse(cx, cy, 6 + seeds[i] * 4, 3 + seeds[i] * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Smoke/flicker spark for low HP
  if (damage > 0.7) {
    ctx.fillStyle = `rgba(255,${100 + Math.random() * 80},0,${0.4 + Math.random() * 0.3})`;
    const px = (Math.random() - 0.5) * (w * 0.5);
    const py = -hh + 2 + Math.random() * 4;
    ctx.beginPath();
    ctx.arc(px, py, 1 + Math.random() * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBolt(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = 'rgba(20,20,28,0.85)';
  ctx.beginPath();
  ctx.arc(x, y, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.arc(x, y, 1.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ===========================================================================
// Wheels & treads
// ===========================================================================

function drawWheels(ctx, w, h, accent, color, t, vx, kind) {
  const hw = w / 2, hh = h / 2;
  const isThick = kind === 'thick';
  const wheelR = h * (isThick ? 0.62 : 0.55);
  const wheelY = hh + 1;
  const positions = [-hw + wheelR * 0.6, hw - wheelR * 0.6];
  // Spin angle — vx dominates, idle wobble when stopped
  const spin = (vx * 0.07) + (Math.abs(vx) < 0.5 ? t * 0.6 : t * 1.2 * Math.sign(vx));

  for (const x of positions) {
    // Tire body
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(x, wheelY, wheelR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Tire tread pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + spin;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * wheelR * 0.82, wheelY + Math.sin(a) * wheelR * 0.82);
      ctx.lineTo(x + Math.cos(a) * wheelR * 0.98, wheelY + Math.sin(a) * wheelR * 0.98);
      ctx.stroke();
    }

    // Rim
    const rimGrad = ctx.createRadialGradient(x - wheelR * 0.2, wheelY - wheelR * 0.2, 1, x, wheelY, wheelR * 0.55);
    rimGrad.addColorStop(0, lighten(accent, 0.35));
    rimGrad.addColorStop(1, accent);
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(x, wheelY, wheelR * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Spokes (rotating with spin)
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + spin;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * wheelR * 0.12, wheelY + Math.sin(a) * wheelR * 0.12);
      ctx.lineTo(x + Math.cos(a) * wheelR * 0.52, wheelY + Math.sin(a) * wheelR * 0.52);
      ctx.stroke();
    }

    // Hub bolt
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x, wheelY, wheelR * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(x, wheelY, wheelR * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawTreads(ctx, w, h, accent, color, t, vx) {
  const hw = w / 2, hh = h / 2;
  const treadH = h * 0.42;
  const treadY = hh - 1;

  // Tread base (rounded pill)
  ctx.fillStyle = '#0a0a0a';
  roundRect(ctx, -hw + 1, treadY, w - 2, treadH, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 1;
  roundRect(ctx, -hw + 1, treadY, w - 2, treadH, 6);
  ctx.stroke();

  // Tread link segments (animated by vx)
  const offset = ((vx * 4 + t * 8) % 6 + 6) % 6;
  ctx.strokeStyle = 'rgba(255,255,255,0.20)';
  ctx.lineWidth = 1.2;
  for (let i = -hw + 4 + offset; i < hw - 4; i += 6) {
    ctx.beginPath();
    ctx.moveTo(i, treadY + 2);
    ctx.lineTo(i, treadY + treadH - 2);
    ctx.stroke();
  }

  // Drive sprockets (3 visible: end-end-middle)
  const wheelR = treadH * 0.42;
  for (const x of [-hw + 6, 0, hw - 6]) {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x, treadY + treadH / 2, wheelR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x, treadY + treadH / 2, wheelR * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  // Center hub glow
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.arc(0, treadY + treadH / 2, wheelR * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

// ===========================================================================
// Top weapons
// ===========================================================================

function drawTop(ctx, w, h, kind, accent, color, attackPulse, t) {
  const hw = w / 2, hh = h / 2;
  ctx.save();
  if (kind === 'arm') {
    // Pneumatic flipper: cylinder + piston rod + flipper plate
    const lift = attackPulse;
    // Hinge mount
    ctx.fillStyle = '#2a2a2a';
    roundRect(ctx, -hw + 6, -hh - 7, 8, 8, 1);
    ctx.fill();
    // Pneumatic cylinder body
    ctx.save();
    ctx.translate(-hw + 10, -hh - 3);
    const cylLen = w * 0.5 + lift * 4;
    const cylGrad = ctx.createLinearGradient(0, -3, 0, 3);
    cylGrad.addColorStop(0, '#999');
    cylGrad.addColorStop(0.5, '#666');
    cylGrad.addColorStop(1, '#333');
    ctx.fillStyle = cylGrad;
    roundRect(ctx, 0, -3.5, cylLen, 7, 1.5);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Piston rod
    ctx.fillStyle = '#ddd';
    ctx.fillRect(cylLen - 2, -1.8, 6, 3.6);
    ctx.restore();
    // Flipper plate (lifts during attack)
    ctx.save();
    ctx.translate(hw - 6, -hh + 1);
    ctx.rotate(-lift * Math.PI * 0.5);
    ctx.fillStyle = lighten(color, 0.15);
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.lineTo(-w * 0.42, -3);
    ctx.lineTo(-w * 0.48, 2);
    ctx.lineTo(2, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Tip highlight
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(-w * 0.42, -3, 4, 1.5);
    ctx.restore();
  } else if (kind === 'forks') {
    // Two parallel forks with hydraulic pistons behind
    ctx.fillStyle = accent;
    // Top fork
    ctx.beginPath();
    ctx.moveTo(hw - 2, -hh - 5);
    ctx.lineTo(hw + w * 0.4, -hh - 5);
    ctx.lineTo(hw + w * 0.5, -hh - 2.5);
    ctx.lineTo(hw + w * 0.4, -hh);
    ctx.lineTo(hw - 2, -hh);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Bottom fork
    ctx.beginPath();
    ctx.moveTo(hw - 2, hh);
    ctx.lineTo(hw + w * 0.4, hh);
    ctx.lineTo(hw + w * 0.5, hh + 2.5);
    ctx.lineTo(hw + w * 0.4, hh + 5);
    ctx.lineTo(hw - 2, hh + 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Hydraulic pistons in back
    ctx.fillStyle = '#777';
    roundRect(ctx, -hw + 6, -hh - 4, 16, 3, 1);
    ctx.fill();
    roundRect(ctx, -hw + 6,  hh + 1, 16, 3, 1);
    ctx.fill();
  } else if (kind === 'hammer') {
    // Hammer head on swinging shaft
    const swing = attackPulse;
    ctx.save();
    ctx.translate(0, -hh + 2);
    ctx.rotate(swing * Math.PI * 0.8);
    const shaftL = h * 0.85;
    // Shaft
    const shaftGrad = ctx.createLinearGradient(-2.5, 0, 2.5, 0);
    shaftGrad.addColorStop(0, '#222');
    shaftGrad.addColorStop(0.5, '#666');
    shaftGrad.addColorStop(1, '#222');
    ctx.fillStyle = shaftGrad;
    ctx.fillRect(-2.5, -shaftL, 5, shaftL);
    // Hammer head (hex)
    ctx.translate(0, -shaftL);
    ctx.fillStyle = accent;
    const hd = 10;
    ctx.beginPath();
    ctx.moveTo(-16,  0);
    ctx.lineTo(-9,  -hd);
    ctx.lineTo( 9,  -hd);
    ctx.lineTo(16,   0);
    ctx.lineTo( 9,  hd);
    ctx.lineTo(-9,  hd);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Head bolts
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(-6, 0, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( 6, 0, 1.6, 0, Math.PI * 2); ctx.fill();
    // Strike face highlight
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-16, -4, 4, 8);
    ctx.fillRect( 12, -4, 4, 8);
    ctx.restore();
  } else if (kind === 'crusher') {
    // Hooked claw rising from front with serrated inner teeth
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(hw - 8, -hh + 6);
    ctx.lineTo(hw - 2, -hh - 20);
    ctx.lineTo(hw + 14, -hh - 22);
    ctx.lineTo(hw + 24, -hh - 10);
    ctx.lineTo(hw + 22, -hh);
    ctx.lineTo(hw + 6,  -hh + 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // Inner highlight
    ctx.fillStyle = lighten(accent, 0.3);
    ctx.beginPath();
    ctx.moveTo(hw - 2, -hh - 4);
    ctx.lineTo(hw + 2, -hh - 16);
    ctx.lineTo(hw + 10, -hh - 12);
    ctx.closePath();
    ctx.fill();
    // Inner serrated teeth
    ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < 4; i++) {
      const tx = hw + 4 + i * 4;
      const ty = -hh - 2;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + 2, ty - 5);
      ctx.lineTo(tx + 4, ty);
      ctx.closePath();
      ctx.fill();
    }
    // Glowing inner eye on the claw
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(hw + 14, -hh - 10, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  // Antenna with blinking tip — universal personality
  ctx.beginPath();
  ctx.moveTo(-hw + 6, -hh + 2);
  ctx.lineTo(-hw + 6, -hh - 11);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  const blink = 0.55 + 0.45 * Math.sin(t * 3.4);
  ctx.fillStyle = color;
  ctx.globalAlpha = blink;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(-hw + 6, -hh - 13, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

// ===========================================================================
// Front spinners
// ===========================================================================

function drawDrum(ctx, w, h, accent, color, t, attackPulse) {
  const hw = w / 2;
  const r = h * 0.5;
  ctx.save();
  ctx.translate(hw - 2, 0);
  const spin = t * 22;

  // Motion blur halo
  ctx.strokeStyle = `rgba(255,255,255,${0.10 + attackPulse * 0.3})`;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r + 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Drum body
  const drumGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
  drumGrad.addColorStop(0, lighten(accent, 0.3));
  drumGrad.addColorStop(1, accent);
  ctx.fillStyle = drumGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Teeth around the drum (rotating)
  ctx.fillStyle = '#1a1a1a';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + spin;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4);
    ctx.lineTo(x + Math.cos(a + 0.3) * r * 0.92, y + Math.sin(a + 0.3) * r * 0.92);
    ctx.closePath();
    ctx.fill();
  }

  // Hub
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSaw(ctx, w, h, accent, color, t, attackPulse) {
  const hw = w / 2;
  ctx.save();
  ctx.translate(hw + 6, 0);

  // Motion-blur disk halo
  ctx.shadowColor = color;
  ctx.shadowBlur = 12 + attackPulse * 16;
  ctx.strokeStyle = `rgba(255,255,255,${0.16 + attackPulse * 0.4})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, h * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Saw blade (rotating)
  ctx.save();
  ctx.rotate(t * 32);
  const teeth = 16;
  ctx.fillStyle = '#dcdcdc';
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const r = (i % 2 === 0) ? h * 0.68 : h * 0.5;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Blade inner ring
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(0, 0, h * 0.32, 0, Math.PI * 2);
  ctx.fill();
  // Hub
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(0, 0, h * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(0, 0, h * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.shadowBlur = 0;

  // Sparks fly during attack
  if (attackPulse > 0) {
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffd400';
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const rad = h * 0.72 + Math.random() * 12;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rad, Math.sin(a) * rad, 1.2 + Math.random() * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ===========================================================================
// Cockpit / eye
// ===========================================================================

function drawCockpit(ctx, w, h, color, accent, t, tier) {
  const hw = w / 2, hh = h / 2;
  const pulse = 0.65 + 0.35 * Math.sin(t * 2.5);
  const cx = hw * 0.25;
  const cy = -hh * 0.05;

  ctx.save();
  if (tier >= 6) {
    // High-tier: angular visor
    ctx.fillStyle = '#0a0a14';
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy - 3);
    ctx.lineTo(cx + 7, cy - 4);
    ctx.lineTo(cx + 10, cy + 2);
    ctx.lineTo(cx - 7, cy + 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy - 1.5);
    ctx.lineTo(cx + 6, cy - 2);
    ctx.lineTo(cx + 8, cy + 1);
    ctx.lineTo(cx - 5, cy + 1.5);
    ctx.closePath();
    ctx.fill();
  } else if (tier >= 3) {
    // Mid-tier: dual round eyes
    ctx.fillStyle = '#0a0a14';
    ctx.beginPath();
    ctx.arc(cx - 3, cy, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + 5, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(cx - 3, cy, 1.4, 0, Math.PI * 2);
    ctx.arc(cx + 5, cy, 1.4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Starter: simple visor slit
    ctx.fillStyle = '#0a0a14';
    roundRect(ctx, cx - 6, cy - 2, 12, 4, 1);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = color;
    ctx.globalAlpha = pulse;
    roundRect(ctx, cx - 4.5, cy - 1, 9, 2, 0.5);
    ctx.fill();
  }
  ctx.restore();
}

// ===========================================================================
// Tiny utilities
// ===========================================================================

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
}

function lighten(col, amount) {
  // Accepts #rrggbb or 3-digit hex; returns rgb(...) string.
  let c = String(col).replace('#', '');
  if (c.length === 3) c = c.split('').map((ch) => ch + ch).join('');
  if (c.length < 6) return col;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const lr = Math.min(255, Math.round(r + (255 - r) * amount));
  const lg = Math.min(255, Math.round(g + (255 - g) * amount));
  const lb = Math.min(255, Math.round(b + (255 - b) * amount));
  return `rgb(${lr},${lg},${lb})`;
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

// ---------------------------------------------------------------------------
// Portrait drawing for shop / garage cards (small canvas, no physics)
// ---------------------------------------------------------------------------
export function drawPortrait(canvas, botId, paintColor) {
  const ctx = canvas.getContext('2d');
  const def = getBot(botId);
  const W = canvas.width, H = canvas.height;
  const tier = def.tier ?? 0;
  const accent = paintColor || def.color;

  // ---- Tier-tinted background gradient
  const tierTopHues = ['#1a234a', '#1a3a4a', '#2a1a4a', '#4a2a1a', '#4a1a3a', '#5a3a1a', '#1a4a3a', '#3a1a5a'];
  const topHue = tierTopHues[Math.min(tier, tierTopHues.length - 1)];
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, topHue);
  bg.addColorStop(0.6, '#0a0e1a');
  bg.addColorStop(1, '#05070d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ---- Faint hex / dot grid in the background
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let y = 8; y < H * 0.78; y += 14) {
    for (let x = (Math.floor(y / 14) % 2) * 7; x < W; x += 14) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- Spotlight cone from above
  const cone = ctx.createRadialGradient(W / 2, 0, 2, W / 2, H * 0.78, W * 0.6);
  cone.addColorStop(0, 'rgba(255,255,255,0.18)');
  cone.addColorStop(0.4, 'rgba(255,255,255,0.04)');
  cone.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cone;
  ctx.fillRect(0, 0, W, H);

  // ---- Floor strip with perspective fade
  const floorY = H * 0.78;
  const floorGrad = ctx.createLinearGradient(0, floorY - 1, 0, H);
  floorGrad.addColorStop(0, `rgba(${hexToRgb(accent)},0.55)`);
  floorGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, floorY, W, H - floorY);
  // Sharp floor line
  ctx.strokeStyle = `rgba(${hexToRgb(accent)},0.85)`;
  ctx.lineWidth = 1.2;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(W * 0.05, floorY);
  ctx.lineTo(W * 0.95, floorY);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ---- Underglow puddle from bot
  const glow = ctx.createRadialGradient(W / 2, floorY + 2, 4, W / 2, floorY + 2, W * 0.5);
  glow.addColorStop(0, accent);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = glow;
  ctx.fillRect(0, H * 0.55, W, H);
  ctx.globalAlpha = 1;

  // ---- Tier label badge (top-right)
  if (tier > 0) {
    const badgeChars = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
    const badge = badgeChars[Math.min(tier, badgeChars.length - 1)];
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = `rgba(${hexToRgb(accent)},0.7)`;
    ctx.fillText(`TIER ${badge}`, W - 6, 4);
  }

  // ---- The bot itself
  const scale = Math.min(W / (def.width + 36), H / (def.height + 60)) * 0.9;
  ctx.save();
  ctx.translate(W / 2, floorY - def.height * scale * 0.5 - 2);
  ctx.scale(scale, scale);
  drawBot(ctx, {
    x: 0, y: 0, a: 0,
    botDef: def,
    width: def.width, height: def.height,
    facing: 1,
    color: accent,
    accent: def.accent,
    onGround: true,
    attackVis: 0,
    chargeMeter: 0,
    vx: 0, vy: 0,
  }, { showCharge: false, t: 0.7 }); // small t so spinners aren't axis-aligned
  ctx.restore();
}

function hexToRgb(col) {
  let c = String(col).replace('#', '');
  if (c.length === 3) c = c.split('').map((ch) => ch + ch).join('');
  if (c.length < 6) return '0,234,255';
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `${r},${g},${b}`;
}
