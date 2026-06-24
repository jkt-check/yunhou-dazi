import { settingsStore } from '@/store';
import { audio } from '@/audio/audioEngine';

export function renderSettings(root: HTMLElement) {
  const s = settingsStore.get();
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
          <span class="setting-label">显示虚拟键盘</span>
          <input type="checkbox" data-key="showVirtualKeyboard" ${s.showVirtualKeyboard ? 'checked' : ''} />
        </label>
      </div>
      <p><a href="#/" class="back-link">← 返回</a></p>
    </main>
  `;

  root.querySelectorAll<HTMLInputElement>('[data-key]').forEach(el => {
    el.addEventListener('change', () => {
      const key = el.dataset.key as keyof typeof s;
      const value = el.type === 'checkbox' ? el.checked : parseFloat(el.value);
      (settingsStore.set as any)({ [key]: value });
      if (key === 'volume') audio.setVolume(value as number);

      // Update label for volume
      if (key === 'volume') {
        const valSpan = root.querySelector('.setting-value');
        if (valSpan) valSpan.textContent = `${Math.round((value as number) * 100)}%`;
      }
    });
  });
}
