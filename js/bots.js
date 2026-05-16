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

  ctx.save();
  ctx.translate(bot.x, -bot.y); // canvas y is downward
  ctx.rotate(-bot.a);
  ctx.scale(facing, 1);

  // ---- Shadow under the bot
  if (opts.shadow !== false && bot.onGround !== false) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.6, w * 0.55, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---- Wheels
  const wheelKind = def.art?.wheel || 'standard';
  drawWheels(ctx, w, h, wheelKind, accent);

  // ---- Body (with wedge front)
  drawBody(ctx, w, h, def.art?.wedge ?? 0.4, color, accent);

  // ---- Top weapon / accessory
  drawTop(ctx, w, h, def.art?.top || 'flat', accent, color, bot.attackVis || 0);

  // ---- Drum / saw indicator (front spinner)
  if (def.art?.drum) drawDrum(ctx, w, h, accent);
  if (def.art?.saw)  drawSaw(ctx, w, h, accent, opts.t || 0);

  // ---- Charge meter (above)
  if ((bot.chargeMeter || 0) > 0.05 && opts.showCharge !== false) {
    ctx.save();
    ctx.scale(facing, 1); // un-flip so text stays readable
    ctx.fillStyle = `rgba(0,234,255,${0.3 + bot.chargeMeter * 0.7})`;
    ctx.fillRect(-w * 0.4, -h * 0.85 - 6, w * 0.8 * bot.chargeMeter, 3);
    ctx.restore();
  }

  // ---- Flipped indicator
  if (bot.flipped) {
    ctx.save();
    ctx.scale(facing, 1);
    ctx.fillStyle = '#ff4d6d';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('×', 0, -h * 0.7);
    ctx.restore();
  }

  ctx.restore();
}

function drawBody(ctx, w, h, wedge, color, accent) {
  const hw = w / 2, hh = h / 2;
  const wedgeOffset = wedge * h; // how much shorter the front-bottom is
  ctx.beginPath();
  ctx.moveTo(-hw,  hh);            // back-top (in canvas coords, top is negative-y)
  ctx.lineTo( hw - wedgeOffset, hh);
  ctx.lineTo( hw, hh - wedgeOffset); // wedge slant
  ctx.lineTo( hw, -hh);            // front-bottom (canvas inverted)
  ctx.lineTo(-hw, -hh);
  ctx.closePath();
  // Gradient fill
  const grad = ctx.createLinearGradient(0, -hh, 0, hh);
  grad.addColorStop(0, color);
  grad.addColorStop(1, accent);
  ctx.fillStyle = grad;
  ctx.fill();
  // Outline
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Highlight
  ctx.beginPath();
  ctx.moveTo(-hw + 4, -hh + 3);
  ctx.lineTo(hw - 4, -hh + 3);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawWheels(ctx, w, h, kind, accent) {
  const hw = w / 2, hh = h / 2;
  const wheelR = h * 0.55;
  const wheelY = hh + 2;
  const positions = [-hw + wheelR * 0.5, hw - wheelR * 0.5];
  ctx.fillStyle = '#1a1a1a';
  for (const x of positions) {
    if (kind === 'tread') {
      // Treads: longer rounded rectangle
      ctx.fillRect(-hw + 4, hh - 2, w - 8, wheelR * 1.2);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      for (let i = -hw + 6; i < hw - 6; i += 4) {
        ctx.beginPath();
        ctx.moveTo(i, hh + wheelR * 0.6);
        ctx.lineTo(i + 2, hh - 1);
        ctx.stroke();
      }
      break; // tread is single piece
    } else {
      ctx.beginPath();
      ctx.arc(x, wheelY, wheelR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(x, wheelY, wheelR * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
    }
  }
}

function drawTop(ctx, w, h, kind, accent, color, attackPulse) {
  const hw = w / 2, hh = h / 2;
  ctx.save();
  if (kind === 'arm') {
    // Pneumatic flipper arm on top, animates up during attack
    const lift = attackPulse > 0 ? 1 : 0;
    const armH = h * 0.5;
    ctx.translate(hw - 6, -hh);
    ctx.rotate(-lift * Math.PI * 0.4);
    ctx.fillStyle = accent;
    ctx.fillRect(-w * 0.5, -armH, w * 0.5 + 4, armH);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(-w * 0.5, -armH, w * 0.5 + 4, armH);
  } else if (kind === 'forks') {
    // Two parallel lift forks pointing forward
    ctx.fillStyle = accent;
    ctx.fillRect(hw - 2, -hh - 4, w * 0.45, 4);
    ctx.fillRect(hw - 2,  hh,     w * 0.45, 4);
  } else if (kind === 'hammer') {
    // Hammer head on a short shaft from top
    const shaftL = h * 0.7;
    ctx.fillStyle = accent;
    ctx.fillRect(-2, -hh - shaftL, 4, shaftL);
    ctx.fillRect(-12, -hh - shaftL - 8, 24, 12);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(-12, -hh - shaftL - 8, 24, 12);
  } else if (kind === 'crusher') {
    // Big jagged claw rising from front
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(hw - 4, -hh);
    ctx.lineTo(hw + 6, -hh - 14);
    ctx.lineTo(hw + 18, -hh - 6);
    ctx.lineTo(hw + 4, -hh + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  // Antenna for personality
  ctx.beginPath();
  ctx.moveTo(-hw + 6, -hh);
  ctx.lineTo(-hw + 6, -hh - 8);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-hw + 6, -hh - 10, 2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawDrum(ctx, w, h, accent) {
  const hw = w / 2, hh = h / 2;
  ctx.save();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(hw - 2, 0, h * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.stroke();
  // teeth
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(hw - 2, 0);
    ctx.lineTo(hw - 2 + Math.cos(a) * h * 0.45, Math.sin(a) * h * 0.45);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSaw(ctx, w, h, accent, t) {
  const hw = w / 2;
  ctx.save();
  ctx.translate(hw + 4, 0);
  ctx.rotate(t * 18);
  ctx.fillStyle = accent;
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = (i % 2 === 0) ? h * 0.6 : h * 0.45;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Portrait drawing for shop / garage cards (small canvas, no physics)
// ---------------------------------------------------------------------------
export function drawPortrait(canvas, botId, paintColor) {
  const ctx = canvas.getContext('2d');
  const def = getBot(botId);
  const W = canvas.width, H = canvas.height;
  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1a234a');
  bg.addColorStop(1, '#0a0e1a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Floor line
  ctx.strokeStyle = 'rgba(0, 234, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.78);
  ctx.lineTo(W, H * 0.78);
  ctx.stroke();
  // Glow under bot
  const glow = ctx.createRadialGradient(W / 2, H * 0.78, 4, W / 2, H * 0.78, W * 0.4);
  glow.addColorStop(0, paintColor || def.color);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = glow;
  ctx.fillRect(0, H * 0.5, W, H);
  ctx.globalAlpha = 1;
  // Bot
  const scale = Math.min(W / (def.width + 30), H / (def.height + 30)) * 0.9;
  ctx.save();
  ctx.translate(W / 2, H * 0.74);
  ctx.scale(scale, scale);
  drawBot(ctx, {
    x: 0, y: 0, a: 0,
    botDef: def,
    width: def.width, height: def.height,
    facing: 1,
    color: paintColor || def.color,
    accent: def.accent,
    onGround: true,
    attackVis: 0,
    chargeMeter: 0,
  }, { showCharge: false, t: 0 });
  ctx.restore();
}
