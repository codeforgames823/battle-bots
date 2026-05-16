// Generate PWA icons (192x192, 512x512, 180x180 apple-touch) from an inline SVG.
// Run: node scripts/generate-icons.js

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'img', 'icons');

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('sharp is not installed. Run: npm install');
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"  stop-color="#0a0e1a"/>
      <stop offset="100%" stop-color="#1a2240"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="55%" r="60%">
      <stop offset="0%"  stop-color="#00eaff" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#00eaff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <circle cx="256" cy="296" r="220" fill="url(#glow)"/>
  <!-- BB wedge silhouette -->
  <g transform="translate(120 320)">
    <polygon points="0,40 110,40 70,0 30,0" fill="#00eaff" stroke="#003844" stroke-width="6"/>
    <circle cx="20" cy="44" r="14" fill="#1a2240" stroke="#00eaff" stroke-width="3"/>
    <circle cx="90" cy="44" r="14" fill="#1a2240" stroke="#00eaff" stroke-width="3"/>
  </g>
  <g transform="translate(280 320)">
    <polygon points="0,40 110,40 80,0 30,0" fill="#ff3b8b" stroke="#5a1530" stroke-width="6"/>
    <circle cx="20" cy="44" r="14" fill="#1a2240" stroke="#ff3b8b" stroke-width="3"/>
    <circle cx="90" cy="44" r="14" fill="#1a2240" stroke="#ff3b8b" stroke-width="3"/>
  </g>
  <text x="256" y="120" font-family="Arial Black, sans-serif" font-size="80" font-weight="900"
        text-anchor="middle" fill="#00eaff" letter-spacing="6" stroke="#000" stroke-width="3">BB</text>
</svg>`;

const sizes = [192, 512, 180];
for (const s of sizes) {
  const name = s === 180 ? 'icon-180.png' : `icon-${s}.png`;
  const out = path.join(OUT, name);
  await sharp(Buffer.from(svg))
    .resize(s, s)
    .png()
    .toFile(out);
  console.log(`${s}x${s} -> ${out}`);
}
console.log('Done.');
