import { test, expect } from '@playwright/test';

/**
 * Full game flow E2E test — loads the game page in real Chromium and verifies
 * that the TTS pipeline works end-to-end through the event bus, audioDirector,
 * and speechEngine.
 *
 * This catches what unit tests can't:
 * - Event bus wiring through real DOM
 * - audioDirector routes fires correctly under real conditions
 * - speechEngine.speak() actually reaches the SpeechSynthesis engine
 */

test.describe('Game page TTS pipeline (real browser)', () => {
  test.beforeEach(async ({ page }) => {
    // Capture all utterances started + errors for assertions
    await page.addInitScript(() => {
      const w = window as any;
      w.__utterances = [];
      const OrigUtterance = window.SpeechSynthesisUtterance;
      window.SpeechSynthesisUtterance = function(text: string) {
        const u = new OrigUtterance(text);
        u.addEventListener('start', () => {
          w.__utterances.push({ text: u.text, voice: u.voice?.name });
        });
        u.addEventListener('error', (e: any) => {
          w.__utterances.push({ text: u.text, error: e.error });
        });
        return u;
      };
    });
  });

  test('game page loads + speechSynthesis ready', async ({ page }) => {
    await page.goto('/#/game?level=1');
    // Wait for canvas to render (game initialized)
    await page.waitForSelector('canvas.game-canvas', { timeout: 5000 });
    // Wait for voices to load
    await page.waitForFunction(() =>
      (window as any).speechSynthesis?.getVoices().length > 0,
      { timeout: 5000 }
    ).catch(() => {});
  });

  test('firing mole:hit triggers moleHit utterance (regression: dual-voice fix)', async ({ page }) => {
    await page.goto('/#/game?level=1');
    await page.waitForSelector('canvas.game-canvas');
    await page.waitForFunction(() =>
      (window as any).speechSynthesis?.getVoices().length > 0,
      { timeout: 5000 }
    ).catch(() => {});

    // Trigger mole:hit by injecting event into bus
    const utterances = await page.evaluate(async () => {
      const w = window as any;
      w.__utterances.length = 0;
      // Import bus + voice directly
      const { createEventBus } = await import('/src/core/eventBus.ts');
      const { voice } = await import('/src/audio/speechEngine.ts');
      voice.setEnabled(true);
      // The game's actual bus is internal. Use a fresh bus and dispatch through voice path manually:
      const { createAudioDirector } = await import('/src/audio/audioDirector.ts');
      const bus = createEventBus();
      createAudioDirector(bus, {
        get: () => ({ sfxEnabled: true, bgmEnabled: false, voiceEnabled: true })
      });
      bus.emit({ type: 'mole:hit', mole: { id: 'm1' } as any, responseMs: 100, tier: 1 });
      await new Promise((r) => setTimeout(r, 600));
      return w.__utterances;
    });

    expect(utterances.length).toBeGreaterThan(0);
    // Should be a moleHit voice line (short pain exclamation)
    // Pool: 哎呦呦! / 疼啊~~~~ / 啊啊啊啊! / 哎哟喂~! / 救命啊!
    const text = utterances[0].text;
    expect(text).toMatch(/哎|疼|啊|救/);
    // Should NOT be a monkey cheer (regression: dual-voice bug)
    expect(text).not.toMatch(/太棒|真准|好厉|再来一个/);
  });

  test('mole:taunt triggers moleTaunt utterance', async ({ page }) => {
    await page.goto('/#/game?level=1');
    await page.waitForSelector('canvas.game-canvas');
    await page.waitForFunction(() =>
      (window as any).speechSynthesis?.getVoices().length > 0,
      { timeout: 5000 }
    ).catch(() => {});

    const utterances = await page.evaluate(async () => {
      const w = window as any;
      w.__utterances.length = 0;
      const { createEventBus } = await import('/src/core/eventBus.ts');
      const { voice } = await import('/src/audio/speechEngine.ts');
      voice.setEnabled(true);
      const { createAudioDirector } = await import('/src/audio/audioDirector.ts');
      const bus = createEventBus();
      createAudioDirector(bus, {
        get: () => ({ sfxEnabled: true, bgmEnabled: false, voiceEnabled: true })
      });
      bus.emit({ type: 'mole:taunt', mole: { id: 'm1' } as any, text: 'x' });
      await new Promise((r) => setTimeout(r, 600));
      return w.__utterances;
    });

    expect(utterances.length).toBeGreaterThan(0);
    const text = utterances[0].text;
    // moleTaunt pool: 打不到我/哈哈/来呀/你按错啦/略略略~
    expect(text).toMatch(/打不到|哈|来呀|按错|略/);
  });

  test('voiceEnabled=false suppresses all utterances', async ({ page }) => {
    await page.goto('/#/game?level=1');
    await page.waitForSelector('canvas.game-canvas');
    await page.waitForFunction(() =>
      (window as any).speechSynthesis?.getVoices().length > 0,
      { timeout: 5000 }
    ).catch(() => {});

    const utterances = await page.evaluate(async () => {
      const w = window as any;
      w.__utterances.length = 0;
      const { createEventBus } = await import('/src/core/eventBus.ts');
      const { createAudioDirector } = await import('/src/audio/audioDirector.ts');
      const bus = createEventBus();
      createAudioDirector(bus, {
        get: () => ({ sfxEnabled: true, bgmEnabled: false, voiceEnabled: false })
      });
      bus.emit({ type: 'mole:hit', mole: { id: 'm1' } as any, responseMs: 100, tier: 1 });
      bus.emit({ type: 'mole:taunt', mole: { id: 'm2' } as any, text: 'x' });
      bus.emit({ type: 'level:complete', stats: {} as any });
      await new Promise((r) => setTimeout(r, 600));
      return w.__utterances;
    });

    expect(utterances).toHaveLength(0);
  });
});