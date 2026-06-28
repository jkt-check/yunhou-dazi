import { test, expect } from '@playwright/test';

/**
 * Full game flow E2E — verifies voice file pipeline triggers when game
 * events fire. Uses file-based voice engine (replaces SpeechSynthesis).
 */

test.describe('Game page voice pipeline (file-based)', () => {
  test('game page loads + voice manifest loaded', async ({ page }) => {
    await page.goto('/#/game?level=1');
    await page.waitForSelector('canvas.game-canvas');
    // Wait for voice manifest to be loaded into the engine
    await page.waitForFunction(async () => {
      const { voice } = await import('/src/audio/speechEngine.ts');
      return (voice as any).manifest !== null;
    }, { timeout: 10000 });
  });

  test('mole:hit triggers moleHit audio play (regression: dual-voice fix)', async ({ page }) => {
    await page.goto('/#/game?level=1');
    await page.waitForSelector('canvas.game-canvas');
    await page.waitForFunction(async () => {
      const { voice } = await import('/src/audio/speechEngine.ts');
      return (voice as any).manifest !== null;
    }, { timeout: 10000 });

    const plays = await page.evaluate(async () => {
      let count = 0;
      const origPlay = HTMLMediaElement.prototype.play;
      const played: Array<{ src: string; time: number }> = [];
      HTMLMediaElement.prototype.play = function () {
        count++;
        played.push({ src: this.src, time: Date.now() });
        return origPlay.call(this);
      };
      const { createEventBus } = await import('/src/core/eventBus.ts');
      const { voice } = await import('/src/audio/speechEngine.ts');
      const { createAudioDirector } = await import('/src/audio/audioDirector.ts');
      const { settingsStore } = await import('/src/store/slices/settings.ts');
      voice.setEnabled(true);
      (voice as any).lastSpeakAtByKind = {};
      const bus = createEventBus();
      createAudioDirector(bus, settingsStore);
      bus.emit({ type: 'mole:hit', mole: { id: 'm1' } as any, responseMs: 100, tier: 1 });
      await new Promise(r => setTimeout(r, 400));
      HTMLMediaElement.prototype.play = origPlay;
      return { count, played };
    });

    expect(plays.count).toBeGreaterThanOrEqual(1);
    const moleHitPlays = plays.played.filter(p => p.src.includes('moleHit'));
    expect(moleHitPlays.length).toBeGreaterThanOrEqual(1);
    // Should NOT have monkeyHit audio
    const monkeyHitPlays = plays.played.filter(p => p.src.includes('monkeyHit'));
    expect(monkeyHitPlays.length).toBe(0);
  });

  test('mole:taunt triggers moleTaunt audio', async ({ page }) => {
    await page.goto('/#/game?level=1');
    await page.waitForSelector('canvas.game-canvas');
    await page.waitForFunction(async () => {
      const { voice } = await import('/src/audio/speechEngine.ts');
      return (voice as any).manifest !== null;
    }, { timeout: 10000 });

    const plays = await page.evaluate(async () => {
      let count = 0;
      const played: string[] = [];
      const origPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        count++;
        played.push(this.src);
        return origPlay.call(this);
      };
      const { createEventBus } = await import('/src/core/eventBus.ts');
      const { voice } = await import('/src/audio/speechEngine.ts');
      const { createAudioDirector } = await import('/src/audio/audioDirector.ts');
      const { settingsStore } = await import('/src/store/slices/settings.ts');
      voice.setEnabled(true);
      (voice as any).lastSpeakAtByKind = {};
      const bus = createEventBus();
      createAudioDirector(bus, settingsStore);
      bus.emit({ type: 'mole:taunt', mole: { id: 'm1' } as any, text: 'x' });
      await new Promise(r => setTimeout(r, 400));
      HTMLMediaElement.prototype.play = origPlay;
      return { count, played };
    });

    expect(plays.count).toBeGreaterThanOrEqual(1);
    const tauntPlays = plays.played.filter(s => s.includes('moleTaunt'));
    expect(tauntPlays.length).toBeGreaterThanOrEqual(1);
  });

  test('voiceEnabled=false suppresses all voice plays', async ({ page }) => {
    await page.goto('/#/game?level=1');
    await page.waitForSelector('canvas.game-canvas');
    await page.waitForFunction(async () => {
      const { voice } = await import('/src/audio/speechEngine.ts');
      return (voice as any).manifest !== null;
    }, { timeout: 10000 });

    const plays = await page.evaluate(async () => {
      let count = 0;
      const origPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        count++;
        return origPlay.call(this);
      };
      const { createEventBus } = await import('/src/core/eventBus.ts');
      const { createAudioDirector } = await import('/src/audio/audioDirector.ts');
      const { settingsStore } = await import('/src/store/slices/settings.ts');
      settingsStore.set({ voiceEnabled: false });
      const bus = createEventBus();
      createAudioDirector(bus, settingsStore);
      bus.emit({ type: 'mole:hit', mole: { id: 'm1' } as any, responseMs: 100, tier: 1 });
      bus.emit({ type: 'mole:taunt', mole: { id: 'm2' } as any, text: 'x' });
      bus.emit({ type: 'level:complete', stats: {} as any });
      await new Promise(r => setTimeout(r, 400));
      HTMLMediaElement.prototype.play = origPlay;
      return count;
    });

    expect(plays).toBe(0);
  });
});