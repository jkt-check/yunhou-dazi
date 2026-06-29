import type { EventBus } from '@/core/eventBus';
import { audio } from './audioEngine';
import { voice } from './speechEngine';

export interface SettingsReader {
  get(): {
    sfxEnabled: boolean;
    bgmEnabled: boolean;
    voiceEnabled: boolean;
    ambientEnabled: boolean;
  };
}

export function createAudioDirector(
  bus: EventBus,
  settings: SettingsReader
): { stop: () => void } {
  const unsubs: Array<() => void> = [];

  const sfxOn = () => settings.get().sfxEnabled;
  const bgmOn = () => settings.get().bgmEnabled;
  const voiceOn = () => settings.get().voiceEnabled;
  const ambientOn = () => settings.get().ambientEnabled;

  // ─── Spawn / hit / miss / taunt ────────────────────────────────────
  unsubs.push(bus.on('mole:spawn', () => {
    if (sfxOn()) audio.playPop();
  }));

  unsubs.push(bus.on('mole:hit', (e) => {
    if (sfxOn()) {
      audio.hitForTier(e.tier);   // player's wooden-mallet whack
      audio.moleHit();            // mole's pain shriek
    }
    if (voiceOn()) {
      // Only mole's pain line per-hit — monkey's cheer moves to combo-tier
      // (combo:tier-up below) so it doesn't fight for the TTS queue.
      voice.speak('moleHit');
    }
  }));

  unsubs.push(bus.on('mole:miss', () => {
    if (sfxOn()) audio.miss();
    // v2 timing: no monkey miss-encouragement voice (SFX miss sound is enough)
  }));

  unsubs.push(bus.on('mole:taunt', () => {
    if (sfxOn()) audio.taunt();
    if (voiceOn()) voice.speak('moleTaunt');
  }));

  // ─── Combo tier-up: escalate BGM + cheer by tier ───────────────────
  unsubs.push(bus.on('combo:tier-up', (e) => {
    if (sfxOn()) {
      audio.tierUp();
      audio.setBgmTier(e.tier);  // enable more BGM tracks as tier climbs
    }
    // v2 timing: no per-tier cheer voice (BGM escalation carries the energy)
  }));

  unsubs.push(bus.on('combo:reset', () => {
    if (sfxOn()) audio.playComboBreak();
    // Reset BGM tier to 1 (only pad+melody) on combo break
    if (audio.isBgmPlaying()) audio.setBgmTier(1);
  }));

  // ─── Wrong key ──────────────────────────────────────────────────────
  unsubs.push(bus.on('key:press', (e) => {
    if (sfxOn() && e.hasActiveMole) audio.playWrongKey();
  }));

  // ─── Level start / end ─────────────────────────────────────────────
  unsubs.push(bus.on('level:start', () => {
    if (sfxOn()) audio.playStartJingle();
    if (bgmOn()) audio.startBgm();
    if (ambientOn()) audio.startAmbient();
    // New in v2 timing: opening greeting (5-line pool) — ceremony moment
    if (voiceOn()) voice.speak('monkeyGreeting');
  }));

  unsubs.push(bus.on('level:complete', () => {
    audio.stopBgm();
    audio.stopAmbient();
    audio.setLowLifeMode(false);
    if (sfxOn()) audio.win();
    if (voiceOn()) voice.speak('monkeyWin');
  }));

  unsubs.push(bus.on('level:fail', () => {
    audio.stopBgm();
    audio.stopAmbient();
    audio.setLowLifeMode(false);
    if (sfxOn()) audio.lose();
    if (voiceOn()) voice.speak('monkeyLose');
  }));

  // ─── Achievement ────────────────────────────────────────────────────
  unsubs.push(bus.on('achievement:unlocked', () => {
    if (sfxOn()) audio.unlock();
  }));

  // ─── Pause / resume (also pause ambient) ──────────────────────────
  unsubs.push(bus.on('game:pause', () => {
    audio.pauseBgm();
    audio.pauseAmbient();
    if (sfxOn()) audio.playPause();
  }));

  unsubs.push(bus.on('game:resume', () => {
    audio.resumeBgm();
    // Regression fix (review round 2): resume ambient unconditionally when
    // there's a paused ambient layer (the audio engine no-ops if no ambient
    // is playing, so we don't need to gate by ambientOn()). The previous
    // version gated by ambientOn(), which left ambientGain stuck at 0 if the
    // user toggled ambientEnabled mid-pause and back on.
    audio.resumeAmbient();
    if (sfxOn()) audio.playResume();
  }));

  // ─── New: low-life heartbeat ──────────────────────────────────────
  unsubs.push(bus.on('life:warning', (e) => {
    if (sfxOn() && e.lives <= 2 && !audio.isLowLifeActive()) {
      audio.setLowLifeMode(true);
    }
    // v2 timing: no low-life voice warning (heartbeat SFX already signals danger)
  }));

  // ─── New: finale (last 10s) ───────────────────────────────────────
  unsubs.push(bus.on('level:finale', (_e) => {
    if (voiceOn()) voice.speak('monkeyFinale');
  }));

  return {
    stop() {
      while (unsubs.length) {
        const u = unsubs.pop();
        try { u?.(); } catch { /* swallow */ }
      }
      // Regression fix (review round 2): stop() previously only cleared the
      // low-life heartbeat. If the user clicked '← 返回' mid-level, BGM and
      // ambient layers kept playing on the home page. Mirror level:complete
      // / level:fail cleanup here so navigation always tears down audio.
      audio.stopBgm();
      audio.stopAmbient();
      audio.setLowLifeMode(false);
    }
  };
}