import { test, expect } from '@playwright/test';

/**
 * Voice diagnostic — run with: `npm run test:e2e -- voice-diagnostic`
 * Captures every utterance start + error and prints available voices.
 *
 * If this passes but you still hear nothing, the problem is OS-level
 * (no Chinese TTS voice installed). The browser CAN speak, it just has
 * no Chinese voice to use.
 */

test('voice diagnostic — voices, starts, errors', async ({ page }) => {
  const messages: string[] = [];
  page.on('console', m => messages.push(`[${m.type()}] ${m.text()}`));

  await page.addInitScript(() => {
    (window as any).__diag = { starts: [], errors: [] };
    const Orig = (window as any).SpeechSynthesisUtterance;
    (window as any).SpeechSynthesisUtterance = function (text: string) {
      const u = new Orig(text);
      u.addEventListener('start', () => (window as any).__diag.starts.push(text));
      u.addEventListener('error', (e: any) =>
        (window as any).__diag.errors.push({ text: u.text, error: e.error }));
      return u;
    };
  });

  await page.goto('/#/game?level=1');
  await page.waitForSelector('canvas.game-canvas');
  await page.locator('canvas.game-canvas').click({ position: { x: 100, y: 100 } });

  // Wait for voices to load
  const voiceReport = await page.evaluate(async () => {
    const synth = (window as any).speechSynthesis;
    if (synth.getVoices().length === 0) {
      await new Promise<void>(resolve => {
        synth.addEventListener('voiceschanged', () => resolve(), { once: true });
        setTimeout(resolve, 2000);
      });
    }
    const allVoices = synth.getVoices();
    return {
      total: allVoices.length,
      chinese: allVoices.filter((v: any) => v.lang.startsWith('zh')).map((v: any) => ({
        name: v.name, lang: v.lang, localService: v.localService, default: v.default
      })),
      sample: allVoices.slice(0, 5).map((v: any) => `${v.name} (${v.lang})`)
    };
  });

  // Press keys to hit moles
  for (const k of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    await page.keyboard.press(k);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(1500);

  const result = await page.evaluate(() => (window as any).__diag);

  console.log('\n=== VOICE DIAGNOSTIC REPORT ===');
  console.log('Total voices available:', voiceReport.total);
  console.log('Sample voices:', voiceReport.sample.join(', '));
  console.log('Chinese voices:');
  if (voiceReport.chinese.length === 0) {
    console.log('  ⚠️  NO CHINESE VOICE INSTALLED');
    console.log('  → Mac: System Settings → Accessibility → Spoken Content → System Voice → Customize → Chinese');
    console.log('  → Windows: Settings → Time & Language → Language → Chinese → Speech → Add a voice');
    console.log('  → Linux: apt install espeak-ng + Chinese voice data');
  } else {
    voiceReport.chinese.forEach((v: any) => {
      console.log(`  ✓ ${v.name} (${v.lang}) local=${v.localService} default=${v.default}`);
    });
  }
  console.log('Utterances started:', result.starts.length);
  if (result.starts.length > 0) {
    console.log('  Examples:', result.starts.slice(0, 3).join(' | '));
  }
  console.log('Utterance errors:', result.errors.length);
  if (result.errors.length > 0) {
    console.log('  Errors:', JSON.stringify(result.errors));
  }
  console.log('=== END REPORT ===\n');

  // Soft assertions — these don't fail the test, just report
  expect(result.starts.length).toBeGreaterThan(0);  // at least one mole got hit + spoke
  expect(result.errors).toHaveLength(0);  // no TTS errors
});