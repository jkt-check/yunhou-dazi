import { settingsStore, type SettingsState } from '@/store/slices/settings';
import { audio } from '@/audio/audioEngine';

export function renderSettings(root: HTMLElement) {
  const s = settingsStore.get();

  function readValue(el: HTMLInputElement | HTMLSelectElement, key: keyof SettingsState): unknown {
    if (key === 'sfxEnabled' || key === 'bgmEnabled' || key === 'voiceEnabled' || key === 'ambientEnabled' || key === 'showVirtualKeyboard') {
      return (el as HTMLInputElement).checked;
    }
    if (key === 'volume') return parseFloat(el.value);
    if (key === 'theme') return el.value as SettingsState['theme'];
    return el.value;
  }

  function applyTheme(theme: SettingsState['theme']) {
    document.documentElement.dataset.theme = theme;
  }

  applyTheme(s.theme);

  root.innerHTML = `
    <main class="page-settings">
      <h2>设置</h2>
      <div class="settings-form">
        <label class="setting-row">
          <span class="setting-label">音量</span>
          <input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-key="volume" />
          <span class="setting-value">${Math.round(s.volume * 100)}%</span>
        </label>
        <label class="setting-row">
          <span class="setting-label">音效</span>
          <input type="checkbox" data-key="sfxEnabled" ${s.sfxEnabled ? 'checked' : ''} />
        </label>
        <label class="setting-row">
          <span class="setting-label">背景音乐</span>
          <input type="checkbox" data-key="bgmEnabled" ${s.bgmEnabled ? 'checked' : ''} />
        </label>
        <label class="setting-row">
          <span class="setting-label">猴子配音</span>
          <input type="checkbox" data-key="voiceEnabled" ${s.voiceEnabled ? 'checked' : ''} />
        </label>
        <label class="setting-row">
          <span class="setting-label">环境音 (竹林风声)</span>
          <input type="checkbox" data-key="ambientEnabled" ${s.ambientEnabled ? 'checked' : ''} />
        </label>
        <label class="setting-row">
          <span class="setting-label">显示虚拟键盘</span>
          <input type="checkbox" data-key="showVirtualKeyboard" ${s.showVirtualKeyboard ? 'checked' : ''} />
        </label>
        <label class="setting-row">
          <span class="setting-label">主题</span>
          <select data-key="theme">
            <option value="default" ${s.theme === 'default' ? 'selected' : ''}>默认（暖纸）</option>
            <option value="sepia" ${s.theme === 'sepia' ? 'selected' : ''}>怀旧（深褐）</option>
            <option value="ink" ${s.theme === 'ink' ? 'selected' : ''}>水墨（深色）</option>
          </select>
        </label>
      </div>
      <p><a href="#/" class="back-link">← 返回</a></p>
    </main>
  `;

  root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-key]').forEach(el => {
    el.addEventListener('change', () => {
      const key = el.dataset.key as keyof SettingsState;
      const value = readValue(el, key);
      settingsStore.set({ [key]: value } as Partial<SettingsState>);
      if (key === 'volume') audio.setVolume(value as number);
      if (key === 'theme') applyTheme(value as SettingsState['theme']);

      // Update label for volume
      if (key === 'volume') {
        const valSpan = root.querySelector('.setting-value');
        if (valSpan) valSpan.textContent = `${Math.round((value as number) * 100)}%`;
      }
    });
  });

  // Regression fix (review round 7): return a cleanup function for CLAUDE.md §5
  // compliance. Currently the change listeners die with their elements via
  // innerHTML replacement on next render, but we wire up the cleanup chain now
  // so future additions (RAF / timers) get torn down properly.
  return () => {
    root.innerHTML = '';
  };
}
