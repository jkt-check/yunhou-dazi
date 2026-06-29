#!/usr/bin/env node
// Composes per-frame PNGs from out/sprites/{role}/{state}-{n}.png into
// public/sprites/{role}.png (2048x2048), and updates sprite-manifest.json
// `count` fields to match the actual file counts.

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
  const composites = [];
  const counts = {};
  for (const [state, frames] of states) {
    counts[state] = frames.length;
    for (let i = 0; i < frames.length; i++) {
      const fp = path.join(SRC, frames[i].file);
      const buf = await sharp(fp)
        .resize(FRAME_SIZE, FRAME_SIZE, { fit: 'contain', background: '#FFFFFF' })
        .png()
        .toBuffer();
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      composites.push({ input: buf, left: col * FRAME_SIZE, top: row * FRAME_SIZE });
    }
  }
  const totalRows = Math.max(1, ...composites.map(c => Math.floor(c.top / FRAME_SIZE) + 1));
  const atlasH = totalRows * FRAME_SIZE;
  await sharp({
    create: { width: ATLAS_W, height: atlasH, channels: 4, background: { r: 245, g: 235, b: 215, alpha: 1 } }
  })
    .composite(composites)
    .png()
    .toFile(OUT_PNG);
  console.log(`Wrote ${OUT_PNG} (${ATLAS_W}x${atlasH}) with ${states.size} states`);

  const manifestRaw = await fs.readFile(MANIFEST, 'utf-8');
  const manifest = JSON.parse(manifestRaw);
  if (!manifest[ROLE]) {
    console.error(`Manifest has no role "${ROLE}"`);
    process.exit(1);
  }
  const sorted = Array.from(states.keys()).sort();
  sorted.forEach((state, idx) => {
    manifest[ROLE].states[state] = {
      ...manifest[ROLE].states[state],
      row: idx,
      count: counts[state]
    };
  });
  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Updated ${MANIFEST} with counts:`, counts);
}

build().catch(err => { console.error(err.message || err); process.exit(1); });
