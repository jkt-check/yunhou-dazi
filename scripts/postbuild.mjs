#!/usr/bin/env node
// Post-build cleanup: strip OS metadata files that Vite copies verbatim from
// public/. Keeps `dist/` deployable as-is (no surprise .DS_Store on Linux
// servers, no ._* AppleDouble files).

import { rm } from 'node:fs/promises';
import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const DIST = 'dist';

// Files we never want shipped. Patterns, not exact names.
const FORBIDDEN = [
  '.DS_Store',
  '.AppleDouble',
  '._*',
  'Thumbs.db',
];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

let removed = 0;
try {
  await stat(DIST);
} catch {
  console.error(`[postbuild] ${DIST}/ not found — did vite build run?`);
  process.exit(1);
}

for await (const file of walk(DIST)) {
  const base = file.split('/').pop();
  if (FORBIDDEN.some((p) => base === p || (p.startsWith('.') && p.endsWith('*') && base.startsWith(p.slice(0, -1))))) {
    await rm(file);
    removed++;
    console.log(`[postbuild] removed ${relative(DIST, file)}`);
  }
}

if (removed === 0) {
  console.log('[postbuild] nothing to clean');
} else {
  console.log(`[postbuild] cleaned ${removed} file(s)`);
}