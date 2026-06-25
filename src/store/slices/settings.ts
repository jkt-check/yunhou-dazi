import { createStore } from '../createStore';
import { persistence } from '../middleware/persistence';

export type ThemeName = 'default' | 'sepia' | 'ink';

export interface SettingsState {
  volume: number;
  sfxEnabled: boolean;
  bgmEnabled: boolean;
  showVirtualKeyboard: boolean;
  theme: ThemeName;
}

const initial: SettingsState = {
  volume: 0.7,
  sfxEnabled: true,
  bgmEnabled: true,
  showVirtualKeyboard: true,
  theme: 'default'
};

export const settingsStore = createStore<SettingsState>(initial)
  .extend(persistence<SettingsState>({
    key: 'yunhou:settings',
    // Whitelist: drop unknown fields on hydrate AND on persist, so the localStorage
    // payload stays forward-compatible with future SettingsState shape changes.
    whitelist: ['volume', 'sfxEnabled', 'bgmEnabled', 'showVirtualKeyboard', 'theme'] as (keyof SettingsState)[]
  }));
