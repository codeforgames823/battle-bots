// One-time art generator. Pulls images from Pollinations.ai (free, no key, no copyright)
// and writes them as WebP under ../img/. Re-run any time to regenerate.
//
//   node scripts/generate-art.js          # generate everything that's missing
//   node scripts/generate-art.js --force  # regenerate all
//
// Requires `sharp` (already in package.json devDependencies).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FORCE = process.argv.includes('--force');

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('sharp is not installed. Run: npm install');
  process.exit(1);
}

const ASSETS = [
  // Hero banner — wide cinematic shot of two robot fighters
  {
    file: 'hero/main.webp',
    prompt: 'two futuristic battle robots facing off in a glowing neon arena, cyberpunk aesthetic, dramatic lighting, sparks flying, dark blue and cyan color scheme, side view, wide cinematic composition, ultra detailed, no logos, no text',
    width: 1600, height: 700, model: 'flux',
  },

  // Arena backgrounds (used as parallax background in-game)
  {
    file: 'arenas/warehouse.webp',
    prompt: 'industrial warehouse arena with concrete floor, metal grates, hanging chains, fluorescent lighting overhead, cyberpunk graffiti, side scrolling perspective, dark moody atmosphere, no logos, no text, no people',
    width: 1600, height: 600, model: 'flux',
  },
  {
    file: 'arenas/factory.webp',
    prompt: 'futuristic robotics factory floor with conveyor belts and robotic arms in the background, neon orange warning lights, steel beams, side view, cyberpunk aesthetic, no people, no logos, no text',
    width: 1600, height: 600, model: 'flux',
  },
  {
    file: 'arenas/lab.webp',
    prompt: 'high-tech research laboratory with glowing holographic displays, glass tubes, sci-fi instruments, side view stage lighting, neon cyan and magenta accents, cyberpunk aesthetic, no people, no logos, no text',
    width: 1600, height: 600, model: 'flux',
  },

  // Bot portrait alternates (canvas drawing is the primary, these are decorative cards)
  ...['wedge', 'flipper', 'drum', 'lifter', 'hammer', 'tank', 'sawblade', 'mecha'].map((id) => ({
    file: `bots/${id}.webp`,
    prompt: portraitPromptFor(id),
    width: 800, height: 480, model: 'flux',
  })),
];

function portraitPromptFor(id) {
  const base = 'product photo of a small armored battle robot on a dark studio background with cyan rim lighting, side view, glossy paint, mechanical detail, isolated subject, no logos, no text, no humans, cyberpunk aesthetic';
  const tags = {
    wedge:    'low wedge robot with two front wheels, simple ramp shape, steel frame',
    flipper:  'pneumatic flipper arm robot, dramatic pose with arm raised, hot pink accents',
    drum:     'spinning drum robot with bright yellow drum on the front, steel wheels',
    lifter:   'forklift style battle robot with two metal forks extending forward, green accents',
    hammer:   'heavy battle robot with a top mounted sledgehammer, purple accents',
    tank:     'tracked battle robot with thick treads and heavy armor, grey paint, low profile',
    sawblade: 'battle robot with a horizontal sawblade weapon on the front, orange accents',
    mecha:    'premium high-tech battle robot with multiple weapons, magenta and chrome paint, sleek angular design',
  }[id] || '';
  return `${tags}, ${base}`;
}

function buildUrl({ prompt, width, height, model = 'flux', seed = 42 }) {
  const enc = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${enc}?width=${width}&height=${height}&model=${model}&nologo=true&enhance=true&seed=${seed}`;
}

async function fetchWithRetry(url, attempts = 3, timeoutMs = 90_000) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      lastErr = e;
      console.warn(`  attempt ${i + 1} failed: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

async function generateOne(asset, seedOffset) {
  const out = path.join(ROOT, 'img', asset.file);
  if (!FORCE && fs.existsSync(out)) {
    console.log(`skip   ${asset.file}  (already exists)`);
    return;
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  console.log(`gen    ${asset.file}  (${asset.width}x${asset.height})`);
  const url = buildUrl({ ...asset, seed: 42 + seedOffset });
  const buf = await fetchWithRetry(url);
  await sharp(buf)
    .resize(asset.width, asset.height, { fit: 'cover' })
    .webp({ quality: 82 })
    .toFile(out);
  console.log(`ok     ${asset.file}`);
}

(async () => {
  let success = 0, failed = 0;
  for (let i = 0; i < ASSETS.length; i++) {
    try {
      await generateOne(ASSETS[i], i);
      success++;
    } catch (e) {
      console.error(`FAIL   ${ASSETS[i].file}: ${e.message}`);
      failed++;
    }
  }
  console.log(`\nDone: ${success} ok, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
})();
