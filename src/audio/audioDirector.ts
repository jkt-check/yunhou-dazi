import type { EventBus } from '@/core/eventBus';
import { audio } from './audioEngine';

export interface SettingsReader {
  get(): { sfxEnabled: boolean; bgmEnabled: boolean };
}

export function createAudioDirector(
  bus: EventBus,
  settings: SettingsReader
): { stop: () => void } {
  const unsubs: Array<() => void> = [];

  const sfxOn = () => settings.get().sfxEnabled;
  const bgmOn = () => settings.get().bgmEnabled;

  unsubs.push(bus.on('mole:spawn', () => {
    if (sfxOn()) audio.playPop();
  }));

  unsubs.push(bus.on('mole:hit', (e) => {
    if (sfxOn()) audio.hitForTier(e.tier);
  }));

  unsubs.push(bus.on('mole:miss', () => {
    if (sfxOn()) audio.miss();
  }));

  unsubs.push(bus.on('mole:taunt', () => {
    if (sfxOn()) audio.taunt();
  }));

  unsubs.push(bus.on('combo:tier-up', () => {
    if (sfxOn()) audio.tierUp();
  }));

  unsubs.push(bus.on('combo:reset', () => {
    if (sfxOn()) audio.playComboBreak();
  }));

  unsubs.push(bus.on('key:press', (e) => {
    if (sfxOn() && e.hasActiveMole) audio.playWrongKey();
  }));

  unsubs.push(bus.on('level:start', () => {
    if (sfxOn()) audio.playStartJingle();
    if (bgmOn()) audio.startBgm();
  }));

  unsubs.push(bus.on('level:complete', () => {
    audio.stopBgm();
    if (sfxOn()) audio.win();
  }));

  unsubs.push(bus.on('level:fail', () => {
    audio.stopBgm();
    if (sfxOn()) audio.lose();
  }));

  unsubs.push(bus.on('achievement:unlocked', () => {
    if (sfxOn()) audio.unlock();
  }));

  unsubs.push(bus.on('game:pause', () => {
    audio.pauseBgm();
    if (sfxOn()) audio.playPause();
  }));

  unsubs.push(bus.on('game:resume', () => {
    audio.resumeBgm();
    if (sfxOn()) audio.playResume();
  }));

  return {
    stop() {
      while (unsubs.length) {
        const u = unsubs.pop();
        try { u?.(); } catch { /* swallow */ }
      }
    }
  };
}
