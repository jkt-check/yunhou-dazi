/**
 * Generate voice pack using Matrix TTS (matrix_batch_text_to_audio).
 *
 * Reads single-source-of-truth from src/speech/voiceLines.ts so the
 * generated manifest always matches the in-code lines.
 *
 * Outputs mp3 files into public/voice/<kind>/<index>.mp3 + manifest.json.
 *
 * Run on Node 22+ (uses --experimental-strip-types for TS import):
 *   node --experimental-strip-types scripts/generate-voice-pack.mjs
 *
 * Notes:
 *   - Matrix TTS doesn't accept empty options cleanly, so we always pass
 *     speed (default 1.0) and volume (default 8).
 *   - Pitch is only sent if non-zero (matrix rejects pitch=0 oddly on
 *     some voices — confirmed safe to omit).
 *   - We batch 5 at a time to stay well under rate limits.
 */

import { execFileSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'voice');

// Single source of truth — keep in sync with src/speech/voiceLines.ts
const { VOICE_LINES } = await import('../src/speech/voiceLines.ts');

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function buildMatrixRequest(kind, idx, line) {
  const req = {
    text: line.text,
    voice_id: line.voice,
    emotion: line.emotion,
    speed: line.speed ?? 1.0,
    volume: 8,
  };
  if (line.pitch && line.pitch !== 0) req.pitch = line.pitch;
  return req;
}

async function generateBatch(requests) {
  const json = JSON.stringify({ requests });
  const out = execFileSync('mavis', [
    'mcp', 'call', 'matrix', 'matrix_batch_text_to_audio', json,
  ], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
  return JSON.parse(out.toString());
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
}

function fileSize(path) {
  return statSync(path).size;
}

async function generateKind(kind) {
  const lines = VOICE_LINES[kind];
  if (!lines) {
    console.warn(`  ⚠ kind "${kind}" not in VOICE_LINES, skipping`);
    return [];
  }
  const kindDir = join(OUT_DIR, kind);
  ensureDir(kindDir);

  const manifest = [];
  const BATCH = 5;

  for (let i = 0; i < lines.length; i += BATCH) {
    const slice = lines.slice(i, i + BATCH);
    const requests = slice.map((line, j) => buildMatrixRequest(kind, i + j, line));
    const result = await generateBatch(requests);
    if (!result.success_items || result.success_items.length !== slice.length) {
      throw new Error(`Batch failed for ${kind}@${i}: ${JSON.stringify(result).slice(0, 200)}`);
    }
    for (let j = 0; j < slice.length; j++) {
      const idx = i + j;
      const item = result.success_items[j];
      const dest = join(kindDir, `${idx}.mp3`);
      const url = item.output_url.startsWith('http')
        ? item.output_url
        : join(ROOT, item.output_url);
      await downloadFile(url, dest);
      const size = fileSize(dest);
      manifest.push({
        file: `/voice/${kind}/${idx}.mp3`,
        text: slice[j].text,
        voice: slice[j].voice,
        emotion: slice[j].emotion,
        speed: slice[j].speed,
        pitch: slice[j].pitch,
        size,
      });
      const cfg = JSON.stringify({
        voice: slice[j].voice,
        emotion: slice[j].emotion,
        speed: slice[j].speed,
        pitch: slice[j].pitch,
      });
      console.log(`  ✓ ${kind}[${idx}] "${slice[j].text}" — ${(size / 1024).toFixed(1)}KB (${cfg})`);
    }
  }
  return manifest;
}

async function main() {
  console.log('=== Generating voice pack (Matrix TTS → mp3) ===');
  console.log(`Output: ${OUT_DIR}`);
  ensureDir(OUT_DIR);

  const kinds = Object.keys(VOICE_LINES);
  console.log(`Kinds: ${kinds.join(', ')}`);
  console.log(`Total lines: ${kinds.reduce((n, k) => n + VOICE_LINES[k].length, 0)}`);

  const manifest = {};
  let totalSize = 0;
  let totalCount = 0;

  for (const kind of kinds) {
    console.log(`\n[${kind}]`);
    const items = await generateKind(kind);
    manifest[kind] = items;
    totalCount += items.length;
    totalSize += items.reduce((s, x) => s + x.size, 0);
  }

  writeFileSync(
    join(OUT_DIR, 'manifest.json'),
    JSON.stringify({ generated: new Date().toISOString(), lines: manifest }, null, 2)
  );

  console.log(`\n=== Done — ${totalCount} lines, total ${(totalSize / 1024 / 1024).toFixed(2)}MB ===`);
  console.log(`Manifest: ${join(OUT_DIR, 'manifest.json')}`);
}

main().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});