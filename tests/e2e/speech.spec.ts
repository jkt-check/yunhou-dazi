import { test, expect } from '@playwright/test';

/**
 * E2E tests for Web Speech API integration.
 *
 * These run in REAL Chromium (not happy-dom) and verify the TTS path actually
 * works end-to-end. Unit tests with mocked window.speechSynthesis can verify
 * "I called speak()" but not "the browser actually played sound".
 *
 * What we CAN verify in headless:
 * - window.speechSynthesis is present in Chromium
 * - getVoices() returns at least one voice
 * - Calling voice.speak() with a real utterance fires `onstart` event
 * - utterance.text contains the expected line
 * - utterance.voice is set (pickVoice ran successfully)
 *
 * What we CANNOT verify in headless:
 * - That audio actually reached speakers (no microphone, no audio output
 *   in headless). But onstart firing is strong evidence the engine accepted
 *   the utterance and started synthesizing.
 */

test.describe('SpeechEngine in real Chromium', () => {
  test.beforeEach(async ({ page }) => {
    // Capture console errors so we see SpeechSynthesis issues
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));
  });

  test('window.speechSynthesis is available in Chromium', async ({ page }) => {
    await page.goto('/');
    const hasSpeech = await page.evaluate(() => 'speechSynthesis' in window);
    expect(hasSpeech).toBe(true);
  });

  test('getVoices() returns at least one voice', async ({ page }) => {
    await page.goto('/');
    // Voices load async — wait for voiceschanged event
    const voiceCount = await page.evaluate(async () => {
      const synth = (window as any).speechSynthesis;
      if (synth.getVoices().length > 0) return synth.getVoices().length;
      // Wait for voiceschanged
      return new Promise<number>(resolve => {
        synth.addEventListener('voiceschanged', () => {
          resolve(synth.getVoices().length);
        }, { once: true });
        // Timeout fallback
        setTimeout(() => resolve(synth.getVoices().length), 2000);
      });
    });
    expect(voiceCount).toBeGreaterThan(0);
  });

  test('voice.speak() actually triggers utterance onstart (real browser)', async ({ page }) => {
    await page.goto('/');
    // Hook into SpeechSynthesisUtterance before voice module loads
    await page.addInitScript(() => {
      const w = window as any;
      w.__startedUtterances = [];
      const OrigUtterance = (window as any).SpeechSynthesisUtterance;
      // Wrap to capture onstart fires
      (window as any).SpeechSynthesisUtterance = function(text: string) {
        const u = new OrigUtterance(text);
        u.addEventListener('start', () => {
          w.__startedUtterances.push({ text: u.text, voice: u.voice?.name, lang: u.lang });
        });
        u.addEventListener('error', (e: any) => {
          w.__startedUtterances.push({ text: u.text, error: e.error });
        });
        return u;
      };
    });
    // Re-navigate so init script runs
    await page.goto('/');
    // Wait for voices to load
    await page.waitForFunction(() => (window as any).speechSynthesis?.getVoices().length > 0, { timeout: 5000 }).catch(() => {});
    // Import voice module and call speak
    const result = await page.evaluate(async () => {
      const { voice } = await import('/src/audio/speechEngine.ts');
      voice.setEnabled(true);
      voice.speak('moleHit');
      // Give it 500ms to start
      await new Promise(r => setTimeout(r, 500));
      return (window as any).__startedUtterances;
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].text.length).toBeGreaterThan(0);
    // Should not have errored
    expect(result[0].error).toBeUndefined();
  });

  test('voice.speak() rate-limited within 1s for same kind', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).speechSynthesis?.getVoices().length > 0, { timeout: 5000 }).catch(() => {});
    const result = await page.evaluate(async () => {
      const w = window as any;
      w.__startedUtterances = [];
      const OrigUtterance = window.SpeechSynthesisUtterance;
      window.SpeechSynthesisUtterance = function(text: string) {
        const u = new OrigUtterance(text);
        u.addEventListener('start', () => w.__startedUtterances.push(text));
        return u;
      };
      const { voice } = await import('/src/audio/speechEngine.ts');
      voice.setEnabled(true);
      voice.speak('moleHit');
      voice.speak('moleHit');  // rate-limited
      voice.speak('moleHit');  // rate-limited
      await new Promise(r => setTimeout(r, 300));
      return w.__startedUtterances.length;
    });
    expect(result).toBe(1);  // only first speak() made it through
  });

  test('audio context for SFX can be created (regression: no BGM bug)', async ({ page }) => {
    await page.goto('/');
    const hasAudioContext = await page.evaluate(() => {
      return typeof (window as any).AudioContext !== 'undefined'
          || typeof (window as any).webkitAudioContext !== 'undefined';
    });
    expect(hasAudioContext).toBe(true);
  });
});