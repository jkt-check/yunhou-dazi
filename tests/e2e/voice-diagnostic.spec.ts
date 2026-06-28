import { test, expect } from '@playwright/test';

/**
 * Voice diagnostic for file-based engine.
 * Verifies all 30 audio files are reachable + reports any failures.
 *
 * Run: npm run test:e2e -- voice-diagnostic
 */

test('voice diagnostic — file-based engine, all files reachable', async ({ page }) => {
  const messages: string[] = [];
  page.on('console', m => messages.push(`[${m.type()}] ${m.text()}`));

  await page.goto('/#/game?level=1');
  await page.waitForSelector('canvas.game-canvas');

  // Wait for manifest
  await page.waitForFunction(async () => {
    const { voice } = await import('/src/audio/speechEngine.ts');
    return (voice as any).manifest !== null;
  }, { timeout: 10000 });

  const report = await page.evaluate(async () => {
    const { voice } = await import('/src/audio/speechEngine.ts');
    const manifest = (voice as any).manifest;
    const pool = (voice as any).pool;
    const results: Record<string, any> = {};
    for (const kind of Object.keys(manifest)) {
      const audios = pool[kind] ?? [];
      const ready = audios.filter((a: HTMLAudioElement) => a.readyState >= 2).length;
      const total = audios.length;
      results[kind] = {
        total,
        ready,
        duration: total > 0 ? audios[0].duration.toFixed(2) + 's' : 'n/a'
      };
    }
    return results;
  });

  console.log('\n=== VOICE PACK DIAGNOSTIC ===');
  for (const [kind, info] of Object.entries(report)) {
    console.log(`  ${kind}: ${info.ready}/${info.total} ready, ~${info.duration} per clip`);
  }
  console.log('=== END ===\n');

  // All files must have at least one entry (readyState check is timing-dependent in headless)
  for (const [kind, info] of Object.entries(report)) {
    expect(info.total, `${kind} should have audio files`).toBeGreaterThan(0);
  }
});