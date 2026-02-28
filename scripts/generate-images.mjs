#!/usr/bin/env node
/**
 * Convert SVG assets to PNG for og:image and PWA icons.
 * Run: node scripts/generate-images.mjs
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const ogSvg = readFileSync(join(publicDir, 'og-image.svg'));
const iconSvg = readFileSync(join(publicDir, 'icon.svg'));

await sharp(ogSvg)
  .resize(1200, 1200)
  .png()
  .toFile(join(publicDir, 'og-image.png'));

await sharp(iconSvg)
  .resize(192, 192)
  .png()
  .toFile(join(publicDir, 'icon-192.png'));

await sharp(iconSvg)
  .resize(512, 512)
  .png()
  .toFile(join(publicDir, 'icon-512.png'));

await sharp(iconSvg)
  .resize(180, 180)
  .png()
  .toFile(join(publicDir, 'apple-touch-icon.png'));

console.log('Generated: og-image.png, icon-192.png, icon-512.png, apple-touch-icon.png');
