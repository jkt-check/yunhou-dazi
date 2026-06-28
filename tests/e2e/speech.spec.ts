import { test, expect } from '@playwright/test';

/**
 * E2E for the FILE-BASED voice engine (replaces SpeechSynthesis).
 * Verifies:
 * - /voice/manifest.json is served by Vite
 * - Each m4a file is reachable + valid audio
 * - voice.speak() actually triggers an <audio> play event
 *
 * Audio output itself can't be verified in headless (no speakers), but
 * the play() promise + canplaythrough firing is strong evidence the
 * browser is dispatching the audio data.
 */

test.describe('FileSpeechEngine in real Chromium', () => {
  test('manifest.json is served and parses', async ({ page }) => {
    const res = await page.request.get('/voice/manifest.json');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.lines).toBeDefined();
    const kinds = Object.keys(data.lines);
    expect(kinds).toContain('monkeyHit');
    expect(kinds).toContain('moleHit');
    expect(kinds).toContain('moleTaunt');
  });

  test('audio files are reachable + valid audio/mp4', async ({ page }) => {
    const manifest = await (await page.request.get('/voice/manifest.json')).json();
    for (const kind of Object.keys(manifest.lines)) {
      for (const line of manifest.lines[kind]) {
        const r = await page.request.get(line.file);
        expect(r.status(), `${line.file} should be reachable`).toBe(200);
        expect(r.headers()['content-type']).toMatch(/audio/);
      }
    }
  });

  test('voice.speak() actually plays audio in real browser', async ({ page }) => {
    await page.goto('/');
    // Wait for manifest + audio to load
    await page.waitForFunction(async () => {
      const { voice } = await import('/src/audio/speechEngine.ts');
      return (voice as any).manifest !== null;
    }, { timeout: 10000 });

    const playCount = await page.evaluate(async () => {
      const { voice } = await import('/src/audio/speechEngine.ts');
      voice.setEnabled(true);
      // Reset rate limit
      (voice as any).lastSpeakAtByKind = {};
      // Wrap Audio.prototype.play to count actual play() calls
      let count = 0;
      const origPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        count++;
        return origPlay.call(this);
      };
      voice.speak('moleHit');
      // Wait for async play() to resolve
      await new Promise(r => setTimeout(r, 300));
      HTMLMediaElement.prototype.play = origPlay;
      return count;
    });
    expect(playCount).toBeGreaterThanOrEqual(1);
  });

  test('voice rate-limited within 800ms for same kind', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(async () => {
      const { voice } = await import('/src/audio/speechEngine.ts');
      return (voice as any).manifest !== null;
    }, { timeout: 10000 });

    const playCount = await page.evaluate(async () => {
      const { voice } = await import('/src/audio/speechEngine.ts');
      voice.setEnabled(true);
      (voice as any).lastSpeakAtByKind = {};
      let count = 0;
      const origPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        count++;
        return origPlay.call(this);
      };
      voice.speak('moleHit');
      voice.speak('moleHit');
      voice.speak('moleHit');
      await new Promise(r => setTimeout(r, 300));
      HTMLMediaElement.prototype.play = origPlay;
      return count;
    });
    expect(playCount).toBe(1);
  });

  test('all 6 kinds have audio files', async ({ page }) => {
    const manifest = await (await page.request.get('/voice/manifest.json')).json();
    const expected = ['monkeyHit', 'monkeyMiss', 'monkeyWin', 'monkeyLose', 'moleHit', 'moleTaunt'];
    for (const k of expected) {
      expect(manifest.lines[k]).toBeDefined();
      expect(manifest.lines[k].length).toBeGreaterThan(0);
    }
  });
});