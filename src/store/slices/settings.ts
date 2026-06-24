import { createStore } from '../createStore';
import { persistence } from '../middleware/persistence';

export type ThemeName = 'default' | 'sepia' | 'ink';

export interface SettingsState {
  volume: number;
  sfxEnabled: boolean;
  showVirtualKeyboard: boolean;
  theme: ThemeName;
}

const initial: SettingsState = {
  volume: 0.7,
  sfxEnabled: true,
  showVirtualKeyboard: true,
  theme: 'default'
};

export const settingsStore = createStore<SettingsState>(initial)
  .extend(persistence<SettingsState>({
    key: 'yunhou:settings',
    // Drop unknown fields on hydrate so old localStorage payloads that still
    // contain `bgmEnabled` (removed in v0.3) don't break the strict SettingsState.
    whitelist: ['volume', 'sfxEnabled', 'showVirtualKeyboard', 'theme'] as (keyof SettingsState)[]
  }));
