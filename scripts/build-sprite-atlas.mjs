#!/usr/bin/env node
// Composes per-frame PNGs from out/sprites/{role}/{state}-{n}.png into
// public/sprites/{role}.png, and updates sprite-manifest.json
// `count` fields to match the actual file counts.
//
// Layout: each state occupies its own row in the atlas, with its frames
// laid out left-to-right in that row. The `row` field in the manifest is
// the source of truth for atlas placement.
//
// Background removal: each input is processed with a flood-fill from the
// four corners. Any pixel within tolerance of the paper color (#F5EBD7)
// and connected to a corner is marked transparent. The character (and any
// ground shadow / non-paper detail) stays opaque. The atlas is composed
// on a transparent canvas, so when drawn by the renderer the canvas-mount's
// paper texture shows through wherever the sprite is transparent.

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
const PAPER_TOLERANCE = 50; // Manhattan distance; covers paper-grain variation

const CROP_BOTTOM_RATIO = { monkey: 0.08, mole: 0.30 };

function isPaperLike(r, g, b) {
  return (
    Math.abs(r - PAPER_RGB.r) +
    Math.abs(g - PAPER_RGB.g) +
    Math.abs(b - PAPER_RGB.b)
  ) < PAPER_TOLERANCE;
}

// Flood-fill from corners; returns Uint8Array (1 = paper/bg, 0 = character).
function buildBgMask(width, height, rawRGBA) {
  const mask = new Uint8Array(width * height);
  const queue = [];
  // Seed: every corner pixel
  const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
  for (const [x, y] of corners) {
    queue.push(y * width + x);
    mask[y * width + x] = 1;
  }
  while (queue.length > 0) {
    const idx = queue.shift();
    const x = idx % width;
    const y = Math.floor(idx / width);
    const pi = idx * 4;
    if (!isPaperLike(rawRGBA[pi], rawRGBA[pi + 1], rawRGBA[pi + 2])) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nidx = ny * width + nx;
      if (mask[nidx]) continue;
      mask[nidx] = 1;
      queue.push(nidx);
    }
  }
  return mask;
}

async function prepFrame(inputPath) {
  const ratio = CROP_BOTTOM_RATIO[ROLE] ?? 0;
  let pipe = sharp(inputPath);
  if (ratio > 0) {
    const meta = await pipe.metadata();
    const cropH = Math.round((meta.height ?? 0) * (1 - ratio));
    pipe = pipe.extract({ left: 0, top: 0, width: meta.width, height: cropH });
  }
  // Resize to FRAME_SIZE; for non-square inputs, fit:'contain' would pad —
  // instead we resize to cover FRAME_SIZE and trim the transparent corners
  // via the mask (corners will be bg by construction after crop+resize).
  const { data, info } = await pipe
    .resize(FRAME_SIZE, FRAME_SIZE, { fit: 'cover' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Build bg mask (flood-fill from corners)
  const bgMask = buildBgMask(info.width, info.height, data);

  // Apply alpha: bg pixels → 0, character pixels → keep with soft edge
  // Soft edge: pixels adjacent to bg get partial alpha so the silhouette
  // doesn't have a hard jagged outline.
  const out = Buffer.alloc(data.length);
  const w = info.width, h = info.height;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const pi = i * 4;
      if (bgMask[i]) {
        // Hard transparent
        out[pi] = data[pi]; out[pi + 1] = data[pi + 1]; out[pi + 2] = data[pi + 2];
        out[pi + 3] = 0;
      } else {
        // Check if any 4-neighbor is bg → partial alpha (feather)
        let bgNeighbors = 0;
        if (x > 0 && bgMask[i - 1]) bgNeighbors++;
        if (x < w - 1 && bgMask[i + 1]) bgNeighbors++;
        if (y > 0 && bgMask[i - w]) bgNeighbors++;
        if (y < h - 1 && bgMask[i + w]) bgNeighbors++;
        const alpha = bgNeighbors > 0 ? 255 - bgNeighbors * 50 : 255;
        out[pi] = data[pi]; out[pi + 1] = data[pi + 1]; out[pi + 2] = data[pi + 2];
        out[pi + 3] = Math.max(0, alpha);
      }
    }
  }

  return sharp(out, { raw: { width: w, height: h, channels: 4 } })
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
    create: { width: ATLAS_W, height: atlasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite(composites)
    .png()
    .toFile(OUT_PNG);
  console.log(`Wrote ${OUT_PNG} (${ATLAS_W}x${atlasH}) with ${states.size} states, transparent bg`);

  for (const [state, spec] of Object.entries(stateRows)) {
    if (counts[state] !== undefined) {
      spec.count = counts[state];
    }
  }
  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Updated ${MANIFEST} counts:`, counts);
}

build().catch(err => { console.error(err.message || err); process.exit(1); });