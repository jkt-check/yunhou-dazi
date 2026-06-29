#!/usr/bin/env node
// Composes per-frame PNGs from out/sprites/{role}/{state}-{n}.png into
// public/sprites/{role}.png, and updates sprite-manifest.json
// `count` fields to match the actual file counts.
//
// Layout: each state occupies its own row in the atlas, with its frames
// laid out left-to-right in that row. The `row` field in the manifest is
// the source of truth for atlas placement.
//
// Background blending: the fit:contain padding and atlas background are
// both paper #F5EBD7 (matching --color-paper on .canvas-mount). The sprite's
// own paper bg blends with this padding, eliminating the "white sticker"
// border. Subtle paper-grain texture from the AI output is preserved so the
// cells don't look flat. The canvas-mount CSS already provides the matching
// --paper-texture dots, so when the canvas is rendered, the sprite cells
// sit on top of a paper-textured background that visually aligns with the
// sprite's own paper grain.

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROLE = process.argv[2] || 'monkey';
const ATLAS_W = 2048;
const FRAME_SIZE = 256;
const COLS = ATLAS_W / FRAME_SIZE;
const SRC = path.resolve(`out/sprites/${ROLE}`);
const OUT_PNG = path.resolve(`public/sprites/${ROLE}.png`);
const MANIFEST = path.resolve(`public/sprites/sprite-manifest.json`);

const PAPER_RGB = { r: 245, g: 235, b: 215 };
const PAPER_HEX = '#F5EBD7';

const CROP_BOTTOM_RATIO = { monkey: 0.08, mole: 0.30 };

async function prepFrame(inputPath) {
  const ratio = CROP_BOTTOM_RATIO[ROLE] ?? 0;
  let pipe = sharp(inputPath);
  if (ratio > 0) {
    const meta = await pipe.metadata();
    const cropH = Math.round((meta.height ?? 0) * (1 - ratio));
    pipe = pipe.extract({ left: 0, top: 0, width: meta.width, height: cropH });
  }
  return pipe
    .resize(FRAME_SIZE, FRAME_SIZE, { fit: 'contain', background: PAPER_HEX })
    .png()
    .toBuffer();
}

async function listStates() {
  let files;
  try {
    files = await fs.readdir(SRC);
  } catch (e) {
    throw new Error(`Cannot read ${SRC}: ${e.message}`);
  }
  const map = new Map();
  for (const f of files) {
    const m = f.match(/^([a-z]+)-(\d+)\.png$/);
    if (!m) continue;
    const [, state, n] = m;
    if (!map.has(state)) map.set(state, []);
    map.get(state).push({ file: f, n: Number(n) });
  }
  for (const arr of map.values()) arr.sort((a, b) => a.n - b.n);
  return map;
}

async function build() {
  const states = await listStates();
  if (states.size === 0) {
    console.error(`No frames found in ${SRC}. Expected: {state}-{n}.png`);
    process.exit(1);
  }

  const manifestRaw = await fs.readFile(MANIFEST, 'utf-8');
  const manifest = JSON.parse(manifestRaw);
  if (!manifest[ROLE]) {
    console.error(`Manifest has no role "${ROLE}"`);
    process.exit(1);
  }
  const stateRows = manifest[ROLE].states;

  const composites = [];
  const counts = {};
  const maxRow = Math.max(...Object.values(stateRows).map(s => s.row ?? 0));
  const totalRows = maxRow + 1;

  for (const [state, frames] of states) {
    counts[state] = frames.length;
    const specRow = stateRows[state]?.row;
    if (specRow === undefined) {
      console.error(`State "${state}" not in manifest — add it to public/sprites/sprite-manifest.json first.`);
      process.exit(1);
    }
    for (let i = 0; i < frames.length; i++) {
      if (i >= COLS) {
        console.error(`State "${state}" has ${frames.length} frames; max ${COLS} per row.`);
        process.exit(1);
      }
      const fp = path.join(SRC, frames[i].file);
      const buf = await prepFrame(fp);
      composites.push({
        input: buf,
        left: i * FRAME_SIZE,
        top: specRow * FRAME_SIZE
      });
    }
  }

  const atlasH = totalRows * FRAME_SIZE;
  await sharp({
    create: { width: ATLAS_W, height: atlasH, channels: 4, background: { ...PAPER_RGB, alpha: 1 } }
  })
    .composite(composites)
    .png()
    .toFile(OUT_PNG);
  console.log(`Wrote ${OUT_PNG} (${ATLAS_W}x${atlasH}) with ${states.size} states, paper bg uniform`);

  for (const [state, spec] of Object.entries(stateRows)) {
    if (counts[state] !== undefined) {
      spec.count = counts[state];
    }
  }
  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Updated ${MANIFEST} counts:`, counts);
}

build().catch(err => { console.error(err.message || err); process.exit(1); });