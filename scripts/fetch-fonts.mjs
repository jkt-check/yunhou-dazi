#!/usr/bin/env node
// Fetch Google Fonts woff2 subsets for the families declared in
// src/styles/global.css and write a local @font-face declaration sheet.
//
// Why: original CSS uses `@import url('https://fonts.googleapis.com/...')`
// which fails offline / on slow networks. Self-hosting keeps the visual
// style and removes the CDN dependency.
//
// Output:
//   public/fonts/<family>/<short-hash>.woff2   (203 files; ~1.3 MB total)
//   src/styles/fonts.css                       (rewritten @font-face list)
//
// Re-run only when the upstream font family list changes; otherwise the
// committed files are what gets shipped. No build-time network dependency.
//
// Usage: node scripts/fetch-fonts.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const CSS_URL =
  'https://fonts.googleapis.com/css2' +
  '?family=ZCOOL+KuaiLe' +
  '&family=Fraunces:opsz,wght@9..144,400;9..144,700' +
  '&family=Noto+Sans+SC:wght@400;700' +
  '&family=JetBrains+Mono:wght@500;700' +
  '&display=swap';

// `text=` narrows the response to subsets that contain ANY of these
// characters. The full ZCOOL KuaiLe is ~7000 glyphs but this app only
// uses ~300 unique CJK chars + Latin + digits + punctuation. Without
// text= we get 203 woff2 files (~5.6 MB); with it we get <20.
//
// Scan src/ and data/ for user-visible string content. The list below
// is the union of: every literal in the codebase + the basic Latin
// alphabet, digits, common punctuation, and the CJK punctuation block.
// Re-run with `--full` (TODO) if you need a complete font fallback.
const NEEDED_TEXT =
  // Latin alphabet (upper + lower)
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' +
  // Digits
  '0123456789' +
  // Common punctuation / symbols
  ' !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~' +
  // CJK punctuation
  '　、。，！？「」『』（）【】《》〈〉；：·…—';

// We need Safari's UA so Google returns woff2 (not woff or ttf that some
// older UAs get). Pinned to a stable Safari version.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15';

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function shortHash(s) {
  return createHash('sha1').update(s).digest('hex').slice(0, 10);
}

/**
 * Parse the @font-face blocks out of Google's CSS response.
 * Returns [{ family, style, weight, unicodeRange, srcUrl }].
 */
function parseFontFaces(css) {
  const faces = [];
  // Strip /* comments */ first
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /@font-face\s*\{([^}]+)\}/g;
  let m;
  while ((m = re.exec(stripped)) !== null) {
    const block = m[1];
    const get = (re2) => {
      const r = block.match(re2);
      return r ? r[1].trim() : null;
    };
    const family = get(/font-family:\s*'([^']+)'/);
    const style = get(/font-style:\s*([^;]+)/) ?? 'normal';
    const weight = get(/font-weight:\s*([^;]+)/) ?? '400';
    const unicodeRange = get(/unicode-range:\s*([^;]+)/) ?? '';
    const srcUrlMatch = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
    if (family && srcUrlMatch) {
      faces.push({
        family,
        style,
        weight,
        unicodeRange,
        srcUrl: srcUrlMatch[1],
      });
    }
  }
  return faces;
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return buf.byteLength;
}

async function main() {
  // Augment needed text with chars actually used in the codebase. We walk
// src/ + data/ for any CJK runs (U+4E00..U+9FFF) and union them with the
// static NEEDED_TEXT above. Done in Node (not via grep) because ugrep on
// macOS returns "invalid character range" for multi-byte ranges when
// invoked through child_process.
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join, extname } = await import('node:path');

  function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) walk(full, out);
      else out.push(full);
    }
    return out;
  }

  const codeChars = new Set(NEEDED_TEXT);
  const sourceExts = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.html', '.css']);
  for (const file of [...walk('src'), ...walk('data')]) {
    if (!sourceExts.has(extname(file))) continue;
    let text;
    try { text = readFileSync(file, 'utf8'); } catch { continue; }
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      // CJK Unified Ideographs (4E00-9FFF) + Extension A (3400-4DBF) +
      // Extension B-G (20000-2FA1F) + CJK Compatibility (F900-FAFF).
      if (
        (cp >= 0x4e00 && cp <= 0x9fff) ||
        (cp >= 0x3400 && cp <= 0x4dbf) ||
        (cp >= 0x20000 && cp <= 0x2fa1f) ||
        (cp >= 0xf900 && cp <= 0xfaff)
      ) {
        codeChars.add(ch);
      }
    }
  }
  const codeText = [...codeChars].join('');
  console.log(`[fonts] requesting subsets covering ${codeChars.size} unique chars (incl. CJK runs in code)`);

  const cssUrl = `${CSS_URL}&text=${encodeURIComponent(codeText)}`;
  console.log(`[fonts] fetching CSS: ${cssUrl.slice(0, 80)}…`);
  const cssRes = await fetch(cssUrl, { headers: { 'User-Agent': UA } });
  if (!cssRes.ok) {
    throw new Error(`Google Fonts CSS responded ${cssRes.status}`);
  }
  const css = await cssRes.text();
  const faces = parseFontFaces(css);
  const uniqueUrls = [...new Set(faces.map((f) => f.srcUrl))];
  console.log(`[fonts] parsed ${faces.length} @font-face block(s), ${uniqueUrls.length} unique woff2`);

  // Map each URL → local path. Hash on URL keeps it stable across runs.
  // The URL format differs:
  //   - full subset:  /s/<family-slug>/v<ver>/<hash>.woff2  → family from path
  //   - dynamic (/text=): /l/font?kit=...&v=...             → family from @font-face block
  // We prefer the @font-face's declared family (always present), then
  // fall back to the URL path.
  const urlToFamily = new Map();
  for (const f of faces) {
    if (!urlToFamily.has(f.srcUrl)) urlToFamily.set(f.srcUrl, f.family);
  }
  const urlToPath = new Map();
  for (const url of uniqueUrls) {
    const declared = urlToFamily.get(url) ?? '';
    let family;
    if (declared) {
      family = slugify(declared);
    } else {
      const slug = url.match(/\/s\/([^/]+)\//)?.[1] ?? 'unknown';
      family = slugify(slug);
    }
    const filename = `${shortHash(url)}.woff2`;
    const dir = `public/fonts/${family}`;
    await mkdir(dir, { recursive: true });
    urlToPath.set(url, `${dir}/${filename}`);
  }

  // Download in parallel (chunked to avoid hammering)
  const chunkSize = 8;
  let downloaded = 0;
  let bytes = 0;
  for (let i = 0; i < uniqueUrls.length; i += chunkSize) {
    const chunk = uniqueUrls.slice(i, i + chunkSize);
    const results = await Promise.allSettled(
      chunk.map((url) => download(url, urlToPath.get(url)))
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        downloaded++;
        bytes += r.value;
      } else {
        console.error(`[fonts] FAIL: ${r.reason.message}`);
        process.exitCode = 1;
      }
    }
  }
  console.log(`[fonts] downloaded ${downloaded}/${uniqueUrls.length} (${(bytes / 1024).toFixed(1)} KB)`);

  // Generate src/styles/fonts.css with @font-face declarations.
  // Path from src/styles/fonts.css → public/fonts/ = ../../public/fonts/
  const cssOut = [];
  for (const f of faces) {
    const localPath = urlToPath.get(f.srcUrl).replace(/^public\//, '/');
    cssOut.push('@font-face {');
    cssOut.push(`  font-family: '${f.family}';`);
    cssOut.push(`  font-style: ${f.style};`);
    cssOut.push(`  font-weight: ${f.weight};`);
    cssOut.push(`  font-display: swap;`);
    cssOut.push(`  src: url('${localPath}') format('woff2');`);
    if (f.unicodeRange) cssOut.push(`  unicode-range: ${f.unicodeRange};`);
    cssOut.push('}');
    cssOut.push('');
  }
  await writeFile(
    'src/styles/fonts.css',
    '/* AUTO-GENERATED by scripts/fetch-fonts.mjs — do not edit by hand.\n' +
      ' * Re-run that script to refresh after upgrading font families. */\n\n' +
      cssOut.join('\n')
  );
  console.log(`[fonts] wrote src/styles/fonts.css`);
}

main().catch((err) => {
  console.error('[fonts]', err);
  process.exit(1);
});