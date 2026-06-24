import { createStore } from '../createStore';
import { persistence } from '../middleware/persistence';

export interface SettingsState {
  volume: number;
  sfxEnabled: boolean;
  bgmEnabled: boolean;
  showVirtualKeyboard: boolean;
  theme: 'default';
}

const initial: SettingsState = {
  volume: 0.7,
  sfxEnabled: true,
  bgmEnabled: true,
  showVirtualKeyboard: true,
  theme: 'default'
};

export const settingsStore = createStore<SettingsState>(initial)
  .extend(persistence<SettingsState>({ key: 'yunhou:settings' }));
