// Battle Bots — deterministic 2D rigid body physics.
// Units: pixels for length, seconds for time. Coordinate system: x right, y up.
// Floor at y = ARENA.floorY. Walls at x = ±ARENA.halfW.
//
// This module is shared verbatim between client (js/physics.js) and server
// (server/physics.js) — keep them identical. Bump PHYSICS_VERSION on changes.

export const PHYSICS_VERSION = 1;

export const ARENA = {
  halfW: 600,        // px (half-width)
  floorY: 0,         // px
  ceilY: 800,        // px (ceiling, mostly for cameras)
  spawnY: 60,        // initial spawn height above floor
};

export const CONST = {
  gravity: 2200,           // px/s^2
  airDragLin: 0.6,         // per-second linear drag (multiplicative)
  airDragAng: 1.2,         // per-second angular drag
  bounce: 0.10,            // floor restitution
  groundFriction: 0.85,    // tangential friction multiplier per second on contact
  motorAccel: 1200,        // px/s^2 toward target wheel speed
  airTorque: 6,            // rad/s^2 in air from input
  flipThreshold: -0.20,    // up.y below this counts as upside-down
  flipDuration: 1.0,       // seconds to count as fully flipped
  attackPowerScale: 70,    // multiplied by bot.attack.power
  attackUpwardRatio: 0.65, // share of attack impulse going upward vs forward
  attackKickback: 0.2,     // self-impulse vs opponent
  specialBoostMult: 2.4,   // velocity multiplier for boost
  bumpThresh: 200,         // m/s impact for damage
  bumpDamage: 0.04,        // hp per (impulse - bumpThresh)
  hpToFlipMult: 1.0,       // hp depletion accelerates flip
};

// ============================================================================
// Vector helpers
// ============================================================================

export function upVec(bot) {
  return { x: -Math.sin(bot.a), y: Math.cos(bot.a) };
}

export function frontVec(bot) {
  // "Front" depends on bot.facing (+1 right, -1 left)
  const f = bot.facing || 1;
  return { x: Math.cos(bot.a) * f, y: Math.sin(bot.a) * f };
}

export function corners(bot) {
  const c = Math.cos(bot.a), s = Math.sin(bot.a);
  const hw = bot.width * 0.5, hh = bot.height * 0.5;
  // CCW: top-front, bottom-front, bottom-back, top-back (in body coords +x = front, +y = up)
  return [
    { x: bot.x + c * hw - s * hh,  y: bot.y + s * hw + c * hh },  // top-front
    { x: bot.x + c * hw + s * hh,  y: bot.y + s * hw - c * hh },  // bottom-front
    { x: bot.x - c * hw + s * hh,  y: bot.y - s * hw - c * hh },  // bottom-back
    { x: bot.x - c * hw - s * hh,  y: bot.y - s * hw + c * hh },  // top-back
  ];
}

function clamp(v, mn, mx) { return v < mn ? mn : v > mx ? mx : v; }

// ============================================================================
// Bot construction
// ============================================================================

export function makeBot(opts) {
  const def = opts.botDef;
  const w = def.width;
  const h = def.height;
  const m = def.weight;
  return {
    id: opts.id,
    slot: opts.slot ?? 0,
    botDef: def,
    x: opts.x ?? 0,
    y: opts.y ?? ARENA.spawnY,
    a: opts.a ?? 0,
    vx: 0, vy: 0, va: 0,
    width: w, height: h,
    mass: m,
    invMass: 1 / m,
    inertia: (m * (w * w + h * h)) / 12,
    invInertia: 12 / (m * (w * w + h * h)),
    hp: def.hp ?? 100,
    maxHp: def.hp ?? 100,
    facing: opts.facing ?? 1,
    color: opts.color ?? def.color,
    accent: def.accent,
    flipTimer: 0,
    flipped: false,
    attackCD: 0,
    specialCD: 0,
    attackVis: 0,        // visualization timer for attack swoosh
    specialVis: 0,
    onGround: false,
    chargeMeter: 0,      // 0..1, fills over time, drains on use
    onHit: null,         // callback (impulseMag) — set by game.js for SFX/particles
    onAttack: null,
    onFlip: null,
  };
}

export function makeWorld() {
  return {
    bots: [],
    t: 0,
    events: [],          // collected each step, consumed by renderer
  };
}

// ============================================================================
// Impulse application
// ============================================================================

export function applyImpulse(bot, px, py, jx, jy) {
  // Linear
  bot.vx += jx * bot.invMass;
  bot.vy += jy * bot.invMass;
  // Angular: r × J  (r = point - center)
  const rx = px - bot.x;
  const ry = py - bot.y;
  bot.va += (rx * jy - ry * jx) * bot.invInertia;
}

// ============================================================================
// Main step
// ============================================================================

export function step(world, inputs, dt) {
  const bots = world.bots;
  world.events = [];
  world.t += dt;

  // Cooldowns + input forces
  for (let i = 0; i < bots.length; i++) {
    const bot = bots[i];
    const input = inputs[i] || { ax: 0, attack: false, special: false };
    bot.attackCD = Math.max(0, bot.attackCD - dt);
    bot.specialCD = Math.max(0, bot.specialCD - dt);
    bot.attackVis = Math.max(0, bot.attackVis - dt);
    bot.specialVis = Math.max(0, bot.specialVis - dt);
    bot.chargeMeter = Math.min(1, bot.chargeMeter + dt * 0.18);
    applyInput(bot, input, dt);
  }

  // Integrate (semi-implicit Euler)
  for (const bot of bots) {
    bot.vy -= CONST.gravity * dt;
    bot.vx *= Math.pow(1 - CONST.airDragLin / 60, 60 * dt);
    bot.vy *= Math.pow(1 - CONST.airDragLin / 60, 60 * dt);
    bot.va *= Math.pow(1 - CONST.airDragAng / 60, 60 * dt);
    bot.x += bot.vx * dt;
    bot.y += bot.vy * dt;
    bot.a += bot.va * dt;
  }

  // Floor + wall constraints
  for (const bot of bots) {
    bot.onGround = false;
    resolveArena(bot);
  }

  // Bot-vs-bot collisions (n^2; fine for n=2)
  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      resolveBots(bots[i], bots[j], world);
    }
  }

  // Attacks (after collisions, so bots are positioned)
  for (let i = 0; i < bots.length; i++) {
    const input = inputs[i] || {};
    if (input.attack && bots[i].attackCD <= 0 && !bots[i].flipped) {
      doAttack(bots[i], bots, world);
    }
    if (input.special && bots[i].specialCD <= 0 && !bots[i].flipped) {
      doSpecial(bots[i], bots, world);
    }
  }

  // Flip + HP detection
  for (const bot of bots) {
    const up = upVec(bot);
    const upsideDown = up.y < CONST.flipThreshold && bot.onGround;
    if (upsideDown || bot.hp <= 0) {
      bot.flipTimer += dt;
      const dur = bot.hp <= 0 ? 0.3 : CONST.flipDuration;
      if (bot.flipTimer >= dur && !bot.flipped) {
        bot.flipped = true;
        if (bot.onFlip) bot.onFlip();
        world.events.push({ type: 'flip', slot: bot.slot });
      }
    } else {
      bot.flipTimer = Math.max(0, bot.flipTimer - dt * 1.5);
    }
  }
}

// ============================================================================
// Input → motor
// ============================================================================

function applyInput(bot, input, dt) {
  if (bot.flipped) return;
  const ax = clamp(input.ax || 0, -1, 1);
  // Update facing based on horizontal velocity (for visual + attack direction)
  if (Math.abs(ax) > 0.1) bot.facing = ax >= 0 ? 1 : -1;

  if (bot.onGround) {
    // Drive via wheel torque: accelerate toward target horizontal speed
    const targetVx = ax * bot.botDef.speed * 18; // px/s
    const dv = targetVx - bot.vx;
    const accel = CONST.motorAccel;
    const maxStep = accel * dt;
    bot.vx += clamp(dv, -maxStep, maxStep);
  } else {
    // Air control: slight rotation steering
    bot.va += ax * CONST.airTorque * dt * (bot.facing > 0 ? 1 : -1);
  }
}

// ============================================================================
// Arena collisions
// ============================================================================

function resolveArena(bot) {
  // Floor: lowest corner below floor is the contact
  let cs = corners(bot);
  let lowest = null, lowestIdx = -1;
  for (let i = 0; i < cs.length; i++) {
    if (cs[i].y < ARENA.floorY) {
      if (!lowest || cs[i].y < lowest.y) {
        lowest = cs[i];
        lowestIdx = i;
      }
    }
  }
  if (lowest) {
    const depth = ARENA.floorY - lowest.y;
    bot.y += depth;
    // Contact point in world space (after positional correction)
    const cp = { x: lowest.x, y: ARENA.floorY };
    // Velocity at contact point: v + va × r
    const rx = cp.x - bot.x;
    const ry = cp.y - bot.y;
    const vAtContactY = bot.vy + bot.va * rx;
    if (vAtContactY < 0) {
      const denom = bot.invMass + (rx * rx) * bot.invInertia;
      const j = -(1 + CONST.bounce) * vAtContactY / denom;
      applyImpulse(bot, cp.x, cp.y, 0, j);
    }
    // Friction (tangential, only on horizontal velocity at contact)
    bot.vx *= Math.pow(1 - CONST.groundFriction / 60, 60 * 0.0167);
    // Damping angular when on ground
    bot.va *= 0.92;
    bot.onGround = true;
  }
  // Walls
  cs = corners(bot);
  for (const c of cs) {
    if (c.x > ARENA.halfW) {
      const depth = c.x - ARENA.halfW;
      bot.x -= depth;
      const cp = { x: ARENA.halfW, y: c.y };
      const rx = cp.x - bot.x, ry = cp.y - bot.y;
      const vAtContactX = bot.vx - bot.va * ry;
      if (vAtContactX > 0) {
        const denom = bot.invMass + (ry * ry) * bot.invInertia;
        const j = -(1 + CONST.bounce) * vAtContactX / denom;
        applyImpulse(bot, cp.x, cp.y, j, 0);
      }
    } else if (c.x < -ARENA.halfW) {
      const depth = -ARENA.halfW - c.x;
      bot.x += depth;
      const cp = { x: -ARENA.halfW, y: c.y };
      const rx = cp.x - bot.x, ry = cp.y - bot.y;
      const vAtContactX = bot.vx - bot.va * ry;
      if (vAtContactX < 0) {
        const denom = bot.invMass + (ry * ry) * bot.invInertia;
        const j = -(1 + CONST.bounce) * vAtContactX / denom;
        applyImpulse(bot, cp.x, cp.y, j, 0);
      }
    }
  }
  // Ceiling guard (rare — keeps things sane)
  if (bot.y > ARENA.ceilY) {
    bot.y = ARENA.ceilY;
    if (bot.vy > 0) bot.vy *= -0.3;
  }
}

// ============================================================================
// Bot-vs-bot collision (SAT)
// ============================================================================

function obbCollide(a, b) {
  const ca = corners(a), cb = corners(b);
  const axes = [
    { x: Math.cos(a.a),  y: Math.sin(a.a) },
    { x: -Math.sin(a.a), y: Math.cos(a.a) },
    { x: Math.cos(b.a),  y: Math.sin(b.a) },
    { x: -Math.sin(b.a), y: Math.cos(b.a) },
  ];
  let minPen = Infinity;
  let normal = null;
  for (const axis of axes) {
    let aMin = Infinity, aMax = -Infinity;
    let bMin = Infinity, bMax = -Infinity;
    for (const p of ca) {
      const d = p.x * axis.x + p.y * axis.y;
      if (d < aMin) aMin = d;
      if (d > aMax) aMax = d;
    }
    for (const p of cb) {
      const d = p.x * axis.x + p.y * axis.y;
      if (d < bMin) bMin = d;
      if (d > bMax) bMax = d;
    }
    const overlap = Math.min(aMax, bMax) - Math.max(aMin, bMin);
    if (overlap <= 0) return null;
    if (overlap < minPen) {
      minPen = overlap;
      normal = { x: axis.x, y: axis.y };
    }
  }
  // Make normal point from a to b
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx * normal.x + dy * normal.y < 0) {
    normal.x = -normal.x;
    normal.y = -normal.y;
  }
  return { penetration: minPen, normal };
}

function resolveBots(a, b, world) {
  const hit = obbCollide(a, b);
  if (!hit) return;
  // Position correction (split by inverse mass)
  const invSum = a.invMass + b.invMass;
  const corr = hit.penetration / invSum;
  a.x -= hit.normal.x * corr * a.invMass;
  a.y -= hit.normal.y * corr * a.invMass;
  b.x += hit.normal.x * corr * b.invMass;
  b.y += hit.normal.y * corr * b.invMass;
  // Approximate contact point: midpoint between centers
  const cp = {
    x: (a.x + b.x) * 0.5,
    y: (a.y + b.y) * 0.5,
  };
  const rax = cp.x - a.x, ray = cp.y - a.y;
  const rbx = cp.x - b.x, rby = cp.y - b.y;
  // Velocities at contact
  const vaxC = a.vx - a.va * ray;
  const vayC = a.vy + a.va * rax;
  const vbxC = b.vx - b.va * rby;
  const vbyC = b.vy + b.va * rbx;
  const rvx = vbxC - vaxC;
  const rvy = vbyC - vayC;
  const rvDotN = rvx * hit.normal.x + rvy * hit.normal.y;
  if (rvDotN > 0) return; // separating already
  const e = 0.20; // restitution between bots
  const raCrossN = rax * hit.normal.y - ray * hit.normal.x;
  const rbCrossN = rbx * hit.normal.y - rby * hit.normal.x;
  const denom =
    a.invMass + b.invMass +
    raCrossN * raCrossN * a.invInertia +
    rbCrossN * rbCrossN * b.invInertia;
  const j = -(1 + e) * rvDotN / denom;
  applyImpulse(a, cp.x, cp.y, -hit.normal.x * j, -hit.normal.y * j);
  applyImpulse(b, cp.x, cp.y,  hit.normal.x * j,  hit.normal.y * j);
  // Damage on big impacts
  const impulseMag = Math.abs(j);
  if (impulseMag > CONST.bumpThresh) {
    const dmg = (impulseMag - CONST.bumpThresh) * CONST.bumpDamage;
    a.hp = Math.max(0, a.hp - dmg / Math.max(0.5, a.botDef.armor));
    b.hp = Math.max(0, b.hp - dmg / Math.max(0.5, b.botDef.armor));
    if (a.onHit) a.onHit(impulseMag);
    if (b.onHit) b.onHit(impulseMag);
    world.events.push({ type: 'bump', x: cp.x, y: cp.y, mag: impulseMag });
  }
}

// ============================================================================
// Attack + special
// ============================================================================

function doAttack(bot, allBots, world) {
  const def = bot.botDef;
  bot.attackCD = def.attack.cooldown;
  bot.attackVis = 0.18;
  if (bot.onAttack) bot.onAttack();
  world.events.push({ type: 'attack', slot: bot.slot, x: bot.x, y: bot.y, kind: def.attack.kind });

  const fv = frontVec(bot);
  const range = def.attack.range;
  // Hitbox: short oriented capsule in front of the bot
  const hitCx = bot.x + fv.x * (bot.width * 0.5 + range * 0.4);
  const hitCy = bot.y + fv.y * (bot.width * 0.5 + range * 0.4) + 6; // slight upward bias for "scoop"
  const hitR  = range * 0.55;
  for (const other of allBots) {
    if (other === bot || other.flipped) continue;
    // Find closest point on opponent OBB to hitbox center (cheap approx: use center distance)
    const dx = other.x - hitCx;
    const dy = other.y - hitCy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const reach = hitR + Math.max(other.width, other.height) * 0.55;
    if (dist > reach) continue;
    // Apply flip impulse: mostly upward, partly forward
    const power = def.attack.power * CONST.attackPowerScale / Math.max(0.5, other.botDef.armor);
    const ux = fv.x * (1 - CONST.attackUpwardRatio);
    const uy = CONST.attackUpwardRatio + Math.max(0, fv.y * 0.3);
    const jx = ux * power;
    const jy = uy * power;
    // Apply at the underside-front of the opponent (better lever arm for flipping)
    const cpx = other.x - fv.x * other.width * 0.35;
    const cpy = other.y - other.height * 0.45;
    applyImpulse(other, cpx, cpy, jx, jy);
    // Add some torque for clean flips
    other.va += (fv.x > 0 ? 1 : -1) * power * 0.0025;
    // HP nibble
    other.hp = Math.max(0, other.hp - 4 / Math.max(0.5, other.botDef.armor));
    // Kickback
    applyImpulse(bot, bot.x + fv.x * bot.width * 0.5, bot.y,
      -jx * CONST.attackKickback, -jy * CONST.attackKickback);
    if (other.onHit) other.onHit(power);
    world.events.push({ type: 'flipHit', slot: other.slot, x: other.x, y: other.y, mag: power });
  }
}

function doSpecial(bot, allBots, world) {
  if (bot.chargeMeter < 0.6) return; // needs some charge
  const def = bot.botDef;
  bot.specialCD = def.special.cooldown;
  bot.specialVis = 0.4;
  bot.chargeMeter = 0;
  world.events.push({ type: 'special', slot: bot.slot, x: bot.x, y: bot.y, kind: def.special.kind });
  const kind = def.special.kind;
  const fv = frontVec(bot);
  if (kind === 'boost') {
    bot.vx += fv.x * def.special.power * 30;
    bot.vy += Math.abs(fv.y) * def.special.power * 6;
  } else if (kind === 'slam') {
    // Big AOE downward shockwave: lifts everything around
    for (const other of allBots) {
      if (other === bot || other.flipped) continue;
      const dx = other.x - bot.x;
      const dy = other.y - bot.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d < 220) {
        const k = (1 - d / 220) * def.special.power * 60;
        applyImpulse(other, other.x, other.y - other.height * 0.5,
          (dx / d) * k * 0.5, k);
        other.hp = Math.max(0, other.hp - k * 0.05 / Math.max(0.5, other.botDef.armor));
      }
    }
  } else if (kind === 'shield') {
    // Brief armor buff: temporarily reduce angular velocity (planted stance)
    bot.va *= 0.2;
    bot.vx *= 0.5;
  } else if (kind === 'spin') {
    // Self spin attack: large angular burst
    bot.va += (bot.facing > 0 ? 1 : -1) * def.special.power * 6;
    for (const other of allBots) {
      if (other === bot || other.flipped) continue;
      const dx = other.x - bot.x;
      const dy = other.y - bot.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d < 140) {
        const k = (1 - d / 140) * def.special.power * 40;
        applyImpulse(other, other.x, other.y, (dx / d) * k, k * 0.5);
      }
    }
  }
}

// ============================================================================
// Network serialization (compact)
// ============================================================================

export function serializeBot(bot) {
  // 9 numbers per bot: x, y, a, vx, vy, va, hp, charge, flags
  const flags = (bot.flipped ? 1 : 0) | (bot.onGround ? 2 : 0)
              | (bot.attackVis > 0 ? 4 : 0) | (bot.specialVis > 0 ? 8 : 0)
              | (bot.facing < 0 ? 16 : 0);
  return [
    +bot.x.toFixed(2),
    +bot.y.toFixed(2),
    +bot.a.toFixed(3),
    +bot.vx.toFixed(2),
    +bot.vy.toFixed(2),
    +bot.va.toFixed(3),
    +bot.hp.toFixed(1),
    +bot.chargeMeter.toFixed(2),
    flags,
  ];
}

export function applyBotState(bot, arr, blendT = 1) {
  // blendT 1 = snap, 0 = ignore
  const [x, y, a, vx, vy, va, hp, charge, flags] = arr;
  if (blendT >= 1) {
    bot.x = x; bot.y = y; bot.a = a;
    bot.vx = vx; bot.vy = vy; bot.va = va;
  } else {
    bot.x += (x - bot.x) * blendT;
    bot.y += (y - bot.y) * blendT;
    bot.a += (a - bot.a) * blendT;
    bot.vx = vx; bot.vy = vy; bot.va = va;
  }
  bot.hp = hp;
  bot.chargeMeter = charge;
  bot.flipped   = !!(flags & 1);
  bot.onGround  = !!(flags & 2);
  bot.attackVis = (flags & 4) ? Math.max(bot.attackVis, 0.18) : bot.attackVis;
  bot.specialVis = (flags & 8) ? Math.max(bot.specialVis, 0.4) : bot.specialVis;
  bot.facing = (flags & 16) ? -1 : 1;
}

// ============================================================================
// Helpers used by AI / UI
// ============================================================================

export function isFlipped(bot) {
  return !!bot.flipped;
}

export function distance(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function reset(bot, x, y, facing) {
  bot.x = x;
  bot.y = y;
  bot.a = 0;
  bot.vx = 0; bot.vy = 0; bot.va = 0;
  bot.hp = bot.maxHp;
  bot.flipped = false;
  bot.flipTimer = 0;
  bot.attackCD = 0;
  bot.specialCD = 0;
  bot.chargeMeter = 0;
  bot.facing = facing;
}
