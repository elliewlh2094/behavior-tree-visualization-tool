import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'public', 'icon.svg');
const outDir = path.join(root, 'public', 'icons');

const ANY_SIZES = [192, 512];
const MASKABLE_SIZES = [192, 512];
const SAFE_ZONE = 0.8;
const BG = '#ffffff';

async function renderAny(size) {
  const out = path.join(outDir, `icon-${size}.png`);
  await sharp(src).resize(size, size, { fit: 'contain', background: BG }).png().toFile(out);
  return out;
}

async function renderMaskable(size) {
  const inner = Math.round(size * SAFE_ZONE);
  const art = await sharp(src).resize(inner, inner, { fit: 'contain', background: BG }).png().toBuffer();
  const out = path.join(outDir, `icon-maskable-${size}.png`);
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: art, gravity: 'center' }])
    .png()
    .toFile(out);
  return out;
}

const produced = [
  ...(await Promise.all(ANY_SIZES.map(renderAny))),
  ...(await Promise.all(MASKABLE_SIZES.map(renderMaskable))),
];
for (const p of produced) console.log('wrote', path.relative(root, p));
