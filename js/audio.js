// Web Audio: tiny SFX bank + procedural drone music.
// All sounds are synthesized — no asset downloads.

import { getSettings } from './storage.js';

let ctx = null;
let masterGain = null;
let sfxGain = null;
let musicGain = null;
let musicNodes = [];
let unlocked = false;

export function initAudio() {
  // Lazy: created on first user gesture (browser autoplay policy)
}

export function unlockAudio() {
  if (unlocked) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  ctx = new Ctx();
  masterGain = ctx.createGain();
  masterGain.gain.value = getSettings().master;
  masterGain.connect(ctx.destination);
  sfxGain = ctx.createGain();
  sfxGain.gain.value = getSettings().sfx;
  sfxGain.connect(masterGain);
  musicGain = ctx.createGain();
  musicGain.gain.value = getSettings().music;
  musicGain.connect(masterGain);
  unlocked = true;
}

export function applySettings() {
  if (!unlocked) return;
  const s = getSettings();
  masterGain.gain.value = s.master;
  sfxGain.gain.value = s.sfx;
  musicGain.gain.value = s.music;
}

// ============================================================================
// SFX
// ============================================================================

function tone(freq, dur, type = 'sine', vol = 0.3, attack = 0.005, decay = 0.1) {
  if (!unlocked) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(vol, ctx.currentTime + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start();
  osc.stop(ctx.currentTime + dur + 0.05);
}

function sweep(fStart, fEnd, dur, type = 'sawtooth', vol = 0.3) {
  if (!unlocked) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(fStart, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(fEnd, ctx.currentTime + dur);
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start();
  osc.stop(ctx.currentTime + dur + 0.02);
}

function noise(dur, vol = 0.3, filterFreq = 1500) {
  if (!unlocked) return;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  src.connect(filt); filt.connect(g); g.connect(sfxGain);
  src.start();
  src.stop(ctx.currentTime + dur + 0.02);
}

export function playSfx(name) {
  if (!unlocked) return;
  switch (name) {
    case 'attack':   sweep(180, 90, 0.18, 'sawtooth', 0.25); break;
    case 'special':  sweep(80, 280, 0.35, 'square', 0.2); tone(60, 0.4, 'sine', 0.2); break;
    case 'flip':     sweep(220, 60, 0.6, 'sawtooth', 0.4); noise(0.3, 0.25, 800); break;
    case 'bump':     noise(0.06, 0.18, 1200); tone(120, 0.07, 'square', 0.15); break;
    case 'win':      tone(523, 0.15); setTimeout(() => tone(659, 0.15), 120); setTimeout(() => tone(784, 0.3), 240); break;
    case 'lose':     tone(392, 0.2); setTimeout(() => tone(330, 0.4), 200); break;
    case 'tick':     tone(900, 0.05, 'square', 0.1); break;
    case 'click':    tone(660, 0.04, 'square', 0.1); break;
    case 'coin':     tone(880, 0.05); setTimeout(() => tone(1320, 0.08), 50); break;
    case 'buy':      sweep(440, 880, 0.25, 'triangle', 0.3); break;
    case 'roundStart': tone(440, 0.1); setTimeout(() => tone(660, 0.15), 100); break;
  }
}

// ============================================================================
// Music: procedural arpeggio drone, swappable scales
// ============================================================================

const SCALES = {
  cyberpunk: [55, 73.42, 82.41, 110, 146.83, 164.81, 220],   // A minor-ish
  arena:     [65.4, 82.41, 98, 130.81, 164.81, 196, 261.63], // C major
  victory:   [82.41, 110, 130.81, 164.81, 196, 246.94, 329.63],
};

let musicTimer = null;

export function startMusic(mode = 'cyberpunk') {
  if (!unlocked) return;
  stopMusic();
  const scale = SCALES[mode] || SCALES.cyberpunk;
  // Bass drone
  const bass = ctx.createOscillator();
  const bassG = ctx.createGain();
  bass.type = 'sawtooth';
  bass.frequency.value = scale[0];
  bassG.gain.value = 0.06;
  const bassF = ctx.createBiquadFilter();
  bassF.type = 'lowpass';
  bassF.frequency.value = 220;
  bass.connect(bassF); bassF.connect(bassG); bassG.connect(musicGain);
  bass.start();
  musicNodes.push(bass);

  // Pad chord (slow LFO on filter)
  const pad = ctx.createOscillator();
  const padG = ctx.createGain();
  pad.type = 'sine';
  pad.frequency.value = scale[2];
  padG.gain.value = 0.04;
  pad.connect(padG); padG.connect(musicGain);
  pad.start();
  musicNodes.push(pad);

  // Arpeggio
  let step = 0;
  const beat = 0.22;
  const playBeat = () => {
    if (!unlocked || musicTimer === null) return;
    const note = scale[(step * 3 + Math.floor(step / 3)) % scale.length] * 4;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = note;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + beat * 0.9);
    osc.connect(g); g.connect(musicGain);
    osc.start();
    osc.stop(ctx.currentTime + beat);
    step++;
  };
  musicTimer = setInterval(playBeat, beat * 1000);
}

export function stopMusic() {
  if (musicTimer !== null) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
  for (const n of musicNodes) {
    try { n.stop(); } catch {}
    try { n.disconnect(); } catch {}
  }
  musicNodes = [];
}

export function getCtx() { return ctx; }
