/**
 * Generate voice pack using macOS 'say' command.
 * Outputs m4a (AAC) files into public/voice/<kind>/<index>.m4a + manifest.json.
 *
 * Run on macOS:
 *   node scripts/generate-voice-pack.mjs
 *
 * Voice mapping:
 *   - monkey voice:  Eddy (中文) — male cartoon-like, mid pitch
 *   - mole voice:    Flo (中文) — female higher pitch, suits pain/mockery
 *
 * Why macOS 'say'? It uses the same Neural TTS that Chrome SpeechSynthesis
 * uses, so the output matches what the browser would speak.
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'public', 'voice');

// Voice assignment — chosen for kid-friendly cartoon character feel
const VOICE_FOR = {
  monkeyHit:  'Eddy (中文（中国大陆）)',     // excited male cheer
  monkeyMiss: 'Eddy (中文（中国大陆）)',     // gentle encouragement
  monkeyWin:  'Eddy (中文（中国大陆）)',     // triumphant
  monkeyLose: 'Eddy (中文（中国大陆）)',     // soft commiserate
  moleHit:    'Flo (中文（中国大陆）)',       // pain shriek — female higher pitch
  moleTaunt:  'Flo (中文（中国大陆）)'        // playful mockery
};

const LINES = {
  monkeyHit:  ['太棒啦!', '打中啦!', '真准!', '好厉害!', '再来一个!'],
  monkeyMiss: ['再来一次!', '别灰心!', '加油加油!', '差一点!', '下次一定行!'],
  monkeyWin:  ['通关啦!', '太厉害啦!', '满分!', '你是打字小高手!', '完美收官!'],
  monkeyLose: ['再来一局!', '加油!', '下次一定行!', '别灰心哦~', '再来一次!'],
  moleHit:    ['哎呦呦!', '疼啊~~~~', '啊啊啊啊!', '哎哟喂~!', '救命啊!'],
  moleTaunt:  ['打不到我!', '哈哈!', '来呀!', '你按错啦!', '略略略~']
};

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function generateOne(kind, index, text, voice) {
  const aiffPath = join(OUT_DIR, `${kind}-${index}.aiff`);
  const m4aPath = join(OUT_DIR, kind, `${index}.m4a`);

  // say with -v voice, -o output.aiff
  try {
    execSync(`say -v "${voice}" -o "${aiffPath}" "${text}"`, { stdio: 'pipe' });
  } catch (e) {
    throw new Error(`say failed for "${text}": ${e.message}`);
  }

  // Convert to m4a (smaller, browser-supported)
  try {
    execSync(`afconvert "${aiffPath}" "${m4aPath}" -d aac -f m4af`, { stdio: 'pipe' });
  } catch (e) {
    throw new Error(`afconvert failed for ${aiffPath}: ${e.message}`);
  }

  // Cleanup intermediate
  try { unlinkSync(aiffPath); } catch {}

  return m4aPath;
}

function main() {
  console.log('=== Generating voice pack (macOS say → m4a) ===');
  ensureDir(OUT_DIR);

  const manifest = {};

  let totalSize = 0;
  for (const [kind, lines] of Object.entries(LINES)) {
    const voice = VOICE_FOR[kind];
    ensureDir(join(OUT_DIR, kind));
    manifest[kind] = [];

    for (let i = 0; i < lines.length; i++) {
      const text = lines[i];
      const file = generateOne(kind, i, text, voice);
      const size = Number(execSync(`stat -f %z "${file}"`).toString().trim());
      totalSize += size;
      manifest[kind].push({ file: `/voice/${kind}/${i}.m4a`, text });
      console.log(`  ✓ ${kind}[${i}] "${text}" — ${(size / 1024).toFixed(1)}KB`);
    }
  }

  writeFileSync(
    join(OUT_DIR, 'manifest.json'),
    JSON.stringify({ generated: new Date().toISOString(), lines: manifest }, null, 2)
  );

  console.log(`\n=== Done — total ${(totalSize / 1024).toFixed(1)}KB ===`);
  console.log(`Manifest written to ${join(OUT_DIR, 'manifest.json')}`);
}

main();