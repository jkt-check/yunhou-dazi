# Monkey Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让猴子在 4 个关键游戏时刻用中文鼓励语"开口"说话,提升 5-7 岁孩子参与感 — 使用浏览器内置 Web Speech API。

**Architecture:** 保持现有 audioDirector 集中路由模式(已有 sfx/bgm)。新增 `src/audio/speechEngine.ts` 封装 SpeechSynthesis,新增 `src/speech/monkeyLines.ts` 纯文案池 + pickLine,扩展 `audioDirector` 加 4 个 voice 路由,settings 加 `voiceEnabled` 开关。所有新逻辑走 TDD,数据层先于引擎层先于集成层。

**Tech Stack:** Vite 5 + TypeScript 5 strict, Web Speech API (`SpeechSynthesis` / `SpeechSynthesisUtterance`),Vitest + happy-dom。

**Spec:** `docs/superpowers/specs/2026-06-27-monkey-voice.md`

---

## File Structure (final)

```
src/
├── audio/
│   ├── speechEngine.ts            🆕 — SpeechSynthesis 封装 (speak/cancel/setEnabled/isSupported)
│   ├── speechEngine.test.ts       🆕 — 单元测试 (mock window.speechSynthesis)
│   ├── audioDirector.ts           🔧 — 加 4 个 voice 路由 + SettingsReader 接口扩 voiceEnabled
│   └── audioDirector.test.ts      🔧 — 加 voice 路由测试
├── speech/
│   ├── monkeyLines.ts             🆕 — 文案池 + pickLine(kind)
│   └── monkeyLines.test.ts        🆕 — 单元测试
├── store/slices/
│   └── settings.ts                🔧 — + voiceEnabled 字段 (默认 true)
└── pages/
    └── settings.ts                🔧 — + voice toggle checkbox

tests/unit/
├── monkeyLines.test.ts            🆕 (在 tests/unit/, src/ 镜像结构)
└── speechEngine.test.ts           🆕 (在 tests/unit/)
```

(注: 项目现状是 `src/audio/audioDirector.test.ts` 在 src 下而不是 tests 下 — 沿用现有约定)

---

## Task Index

- **Stage 1 (数据层)**: Tasks 1-2
- **Stage 2 (引擎层)**: Tasks 3-4
- **Stage 3 (集成层)**: Tasks 5-7
- **Stage 4 (回归)**: Task 8

Total: 8 tasks. 测试目标: 144 → ~155 (新增 ~11 个测试)。

---

## Stage 1: Data Layer

### Task 1: TDD monkeyLines.pickLine

**Files:**
- Create: `src/speech/monkeyLines.ts`
- Create: `tests/unit/monkeyLines.test.ts`

- [ ] **Step 1: 写失败的测试**

创建 `tests/unit/monkeyLines.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { pickLine } from '@/speech/monkeyLines';
import { LINES } from '@/speech/monkeyLines';

describe('pickLine', () => {
  it('returns a non-empty string for each kind', () => {
    (['hit', 'miss', 'win', 'lose'] as const).forEach((kind) => {
      const line = pickLine(kind);
      expect(typeof line).toBe('string');
      expect(line.length).toBeGreaterThan(0);
    });
  });

  it('only returns lines from the matching pool (no cross-pool contamination)', () => {
    (['hit', 'miss', 'win', 'lose'] as const).forEach((kind) => {
      const line = pickLine(kind);
      expect(LINES[kind]).toContain(line);
    });
  });

  it('eventually returns all 5 lines per kind (sample size covers pool)', () => {
    (['hit', 'miss', 'win', 'lose'] as const).forEach((kind) => {
      const seen = new Set<string>();
      // 抽样 50 次,在 5 条池子里应该能覆盖全部 (随机抽样)
      for (let i = 0; i < 50; i++) {
        seen.add(pickLine(kind));
      }
      expect(seen.size).toBe(LINES[kind].length);
    });
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/monkeyLines.test.ts 2>&1 | tail -10
```

预期: FAIL — "Cannot find module '@/speech/monkeyLines'"

- [ ] **Step 3: 实现**

创建 `src/speech/monkeyLines.ts`:

```typescript
import { randIndex } from '@/utils/random';
import type { VoiceLineKind } from '@/audio/speechEngine';

export const LINES: Record<VoiceLineKind, readonly string[]> = {
  hit:  ['太棒啦!', '打中啦!', '真准!', '好厉害!', '再来一个!'],
  miss: ['再来一次!', '别灰心!', '加油加油!', '差一点!', '下次一定行!'],
  win:  ['通关啦!', '太厉害啦!', '满分!', '你是打字小高手!', '完美收官!'],
  lose: ['再来一局!', '加油!', '下次一定行!', '别灰心哦~', '再来一次!']
};

/**
 * Randomly pick one line from the pool for the given kind.
 * Uses project's randIndex (clamp-safe) instead of Math.floor.
 */
export function pickLine(kind: VoiceLineKind): string {
  const pool = LINES[kind];
  return pool[randIndex(pool.length)];
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/monkeyLines.test.ts 2>&1 | tail -10
```

预期: PASS,3 个测试通过。

- [ ] **Step 5: Commit**

```bash
git add src/speech/monkeyLines.ts tests/unit/monkeyLines.test.ts
git commit -m "feat(speech): add monkeyLines with 5 random lines per kind"
```

---

### Task 2: settings 加 voiceEnabled 字段

**Files:**
- Modify: `src/store/slices/settings.ts`

(无新单测 — settings store 有 settings.test.ts 但只测 persistence,扩字段不会破坏现有测试。)

- [ ] **Step 1: 修改 SettingsState 接口加 voiceEnabled**

修改 `src/store/slices/settings.ts`:

```typescript
export interface SettingsState {
  volume: number;
  sfxEnabled: boolean;
  bgmEnabled: boolean;
  voiceEnabled: boolean;        // ← 新增
  showVirtualKeyboard: boolean;
  theme: ThemeName;
}

const initial: SettingsState = {
  volume: 0.7,
  sfxEnabled: true,
  bgmEnabled: true,
  voiceEnabled: true,           // ← 新增,默认开
  showVirtualKeyboard: true,
  theme: 'default'
};

export const settingsStore = createStore<SettingsState>(initial)
  .extend(persistence<SettingsState>({
    key: 'yunhou:settings',
    whitelist: ['volume', 'sfxEnabled', 'bgmEnabled', 'voiceEnabled', 'showVirtualKeyboard', 'theme'] as (keyof SettingsState)[]
  }));
```

- [ ] **Step 2: 类型校验 + 全测试通过**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx tsc --noEmit && npm test 2>&1 | tail -15
```

预期: TS 通过, 144 个测试全部通过。

- [ ] **Step 3: Commit**

```bash
git add src/store/slices/settings.ts
git commit -m "feat(settings): add voiceEnabled field (default true)"
```

---

## Stage 2: Engine Layer

### Task 3: TDD speechEngine 基础 (speak, isSupported, setEnabled)

**Files:**
- Create: `src/audio/speechEngine.ts`
- Create: `tests/unit/speechEngine.test.ts`

- [ ] **Step 1: 写失败的测试**

创建 `tests/unit/speechEngine.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { voice, type VoiceLineKind } from '@/audio/speechEngine';

interface MockUtterance {
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
  voice: any;
  text: string;
}

describe('SpeechEngine', () => {
  let speakCalls: MockUtterance[];
  let cancelCalls: number;
  let voices: any[];
  let synthExists: boolean;

  beforeEach(() => {
    speakCalls = [];
    cancelCalls = 0;
    voices = [
      { lang: 'en-US', name: 'en-US-1' },
      { lang: 'zh-CN', name: 'zh-CN-Google' },
      { lang: 'zh-CN', name: 'zh-CN-Xunfei' }
    ];
    synthExists = true;

    (window as any).speechSynthesis = {
      getVoices: () => voices,
      speak: (u: any) => speakCalls.push({ ...u }),
      cancel: () => { cancelCalls++; }
    };

    // Reset voice module state between tests
    voice.setEnabled(true);
  });

  afterEach(() => {
    delete (window as any).speechSynthesis;
  });

  it('speak() is no-op when SpeechSynthesis API is unavailable', () => {
    synthExists = false;
    delete (window as any).speechSynthesis;
    expect(() => voice.speak('hit')).not.toThrow();
  });

  it('speak() creates an utterance with text from the matching pool', () => {
    voice.speak('hit');
    expect(speakCalls).toHaveLength(1);
    expect(speakCalls[0].text.length).toBeGreaterThan(0);
  });

  it('speak() applies fixed TTS config (zh-CN / rate 0.95 / pitch 1.1 / volume 0.85)', () => {
    voice.speak('hit');
    const u = speakCalls[0];
    expect(u.lang).toBe('zh-CN');
    expect(u.rate).toBe(0.95);
    expect(u.pitch).toBe(1.1);
    expect(u.volume).toBe(0.85);
  });

  it('speak() picks a zh-CN voice from getVoices()', () => {
    voice.speak('hit');
    expect(speakCalls[0].voice.lang).toBe('zh-CN');
  });

  it('speak() cancels previous utterance before speaking (avoid overlap)', () => {
    voice.speak('hit');
    expect(cancelCalls).toBe(0);  // 第一次 speak 不 cancel
    voice.speak('miss');
    expect(cancelCalls).toBe(1);  // 第二次 speak 先 cancel 之前的
  });

  it('speak() is suppressed when called within minIntervalMs (1000ms) of last call', () => {
    voice.speak('hit');
    expect(speakCalls).toHaveLength(1);
    voice.speak('hit');  // 立即再调一次,应该被 rate limit 抑制
    expect(speakCalls).toHaveLength(1);
  });

  it('setEnabled(false) cancels current utterance and blocks future speaks', () => {
    voice.setEnabled(false);
    voice.speak('hit');
    expect(speakCalls).toHaveLength(0);
    expect(cancelCalls).toBeGreaterThanOrEqual(1);
  });

  it('isSupported() returns false when SpeechSynthesis is unavailable', () => {
    delete (window as any).speechSynthesis;
    expect(voice.isSupported()).toBe(false);
  });

  it('isSupported() returns true when SpeechSynthesis is available', () => {
    expect(voice.isSupported()).toBe(true);
  });

  it('speak() each kind returns a non-empty utterance', () => {
    (['hit', 'miss', 'win', 'lose'] as VoiceLineKind[]).forEach((kind) => {
      speakCalls.length = 0;  // 清空
      voice.speak(kind);
      expect(speakCalls).toHaveLength(1);
      expect(speakCalls[0].text.length).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/speechEngine.test.ts 2>&1 | tail -10
```

预期: FAIL — "Cannot find module '@/audio/speechEngine'"

- [ ] **Step 3: 实现**

创建 `src/audio/speechEngine.ts`:

```typescript
import { pickLine } from '@/speech/monkeyLines';

export type VoiceLineKind = 'hit' | 'miss' | 'win' | 'lose';

const TTS_CONFIG = {
  lang: 'zh-CN',
  rate: 0.95,
  pitch: 1.1,
  volume: 0.85
};

const MIN_INTERVAL_MS = 1000;

export interface VoiceEngine {
  speak(kind: VoiceLineKind): void;
  cancel(): void;
  setEnabled(enabled: boolean): void;
  isSupported(): boolean;
}

class SpeechEngineImpl implements VoiceEngine {
  private enabled = true;
  private lastSpeakAt = 0;

  speak(kind: VoiceLineKind): void {
    if (!this.enabled) return;
    if (!this.isSupported()) return;

    const now = performance.now();
    if (now - this.lastSpeakAt < MIN_INTERVAL_MS) return;
    this.lastSpeakAt = now;

    const line = pickLine(kind);
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(line);
    u.lang = TTS_CONFIG.lang;
    u.rate = TTS_CONFIG.rate;
    u.pitch = TTS_CONFIG.pitch;
    u.volume = TTS_CONFIG.volume;
    const zhVoice = pickZhCnVoice();
    if (zhVoice) u.voice = zhVoice;

    synth.cancel();  // 打断之前的 utterance,避免叠加
    synth.speak(u);
  }

  cancel(): void {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.cancel();
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }
}

function pickZhCnVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'zh-CN') ?? null;
}

export const voice: VoiceEngine = new SpeechEngineImpl();
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/speechEngine.test.ts 2>&1 | tail -15
```

预期: PASS, 10 个测试通过。

- [ ] **Step 5: 全量回归**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npm test 2>&1 | tail -10
```

预期: 144 + 3 (monkeyLines) + 10 (speechEngine) = 157 个测试通过。

(注: settings 字段加 voiceEnabled 不需要新单测,settings.test.ts 已覆盖 persistence)

- [ ] **Step 6: Commit**

```bash
git add src/audio/speechEngine.ts tests/unit/speechEngine.test.ts
git commit -m "feat(audio): add SpeechEngine wrapping SpeechSynthesis with rate limit"
```

---

## Stage 3: Integration Layer

### Task 4: audioDirector 加 voice 路由 + SettingsReader 扩 voiceEnabled

**Files:**
- Modify: `src/audio/audioDirector.ts`

(测试在 Task 5 单独加)

- [ ] **Step 1: 修改 SettingsReader 接口加 voiceEnabled**

修改 `src/audio/audioDirector.ts` 顶部:

```typescript
export interface SettingsReader {
  get(): { sfxEnabled: boolean; bgmEnabled: boolean; voiceEnabled: boolean };
}
```

- [ ] **Step 2: 加 voiceOn 内部 helper + 4 个路由的 voice 调用**

修改 `src/audio/audioDirector.ts` 的 `createAudioDirector` 函数:

```typescript
import { voice } from './speechEngine';

export function createAudioDirector(
  bus: EventBus,
  settings: SettingsReader
): { stop: () => void } {
  const unsubs: Array<() => void> = [];

  const sfxOn = () => settings.get().sfxEnabled;
  const bgmOn = () => settings.get().bgmEnabled;
  const voiceOn = () => settings.get().voiceEnabled;  // ← 新增

  unsubs.push(bus.on('mole:spawn', () => {
    if (sfxOn()) audio.playPop();
  }));

  unsubs.push(bus.on('mole:hit', (e) => {
    if (sfxOn()) audio.hitForTier(e.tier);
    if (voiceOn()) voice.speak('hit');  // ← 新增
  }));

  unsubs.push(bus.on('mole:miss', () => {
    if (sfxOn()) audio.miss();
    if (voiceOn()) voice.speak('miss');  // ← 新增
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
    if (voiceOn()) voice.speak('win');  // ← 新增
  }));

  unsubs.push(bus.on('level:fail', () => {
    audio.stopBgm();
    if (sfxOn()) audio.lose();
    if (voiceOn()) voice.speak('lose');  // ← 新增
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
```

- [ ] **Step 2: 类型校验**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx tsc --noEmit 2>&1 | tail -10
```

预期: 0 错误。

- [ ] **Step 3: Commit**

```bash
git add src/audio/audioDirector.ts
git commit -m "feat(audio): route hit/miss/complete/fail through voice engine"
```

---

### Task 5: TDD audioDirector voice 路由

**Files:**
- Modify: `src/audio/audioDirector.test.ts`

- [ ] **Step 1: 改测试文件 mock voice 模块**

修改 `src/audio/audioDirector.test.ts` 顶部的 mock:

```typescript
// 现有 mock (audio module) 替换为:

vi.mock('@/audio/audioEngine', () => ({
  audio: {
    hitForTier: vi.fn(),
    miss: vi.fn(),
    taunt: vi.fn(),
    tierUp: vi.fn(),
    playComboBreak: vi.fn(),
    playPop: vi.fn(),
    playWrongKey: vi.fn(),
    playStartJingle: vi.fn(),
    playPause: vi.fn(),
    playResume: vi.fn(),
    unlock: vi.fn(),
    win: vi.fn(),
    lose: vi.fn(),
    startBgm: vi.fn(),
    stopBgm: vi.fn(),
    pauseBgm: vi.fn(),
    resumeBgm: vi.fn()
  }
}));

vi.mock('@/audio/speechEngine', () => ({
  voice: {
    speak: vi.fn(),
    cancel: vi.fn(),
    setEnabled: vi.fn(),
    isSupported: vi.fn(() => true)
  }
}));

// 同时改 SettingsReader 类型:加 voiceEnabled
```

- [ ] **Step 2: 修改 settings 类型 + 新增 4 个 voice 测试**

修改 `src/audio/audioDirector.test.ts`:

```typescript
import { voice } from '@/audio/speechEngine';  // ← 加在 import 区

// 类型扩展:
let settings: { get: () => { sfxEnabled: boolean; bgmEnabled: boolean; voiceEnabled: boolean } };

beforeEach(() => {
  vi.clearAllMocks();
  bus = createEventBus();
  settings = { get: () => ({ sfxEnabled: true, bgmEnabled: true, voiceEnabled: true }) };
  audioMock = audio as any;
});

// 在 describe('audioDirector', () => { ... }) 末尾追加:

describe('voice routing', () => {
  it('mole:hit triggers voice.speak("hit") when voiceEnabled', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'mole:hit', mole: {} as any, responseMs: 200, tier: 1 });
    expect(voice.speak).toHaveBeenCalledWith('hit');
    d.stop();
  });

  it('mole:miss triggers voice.speak("miss") when voiceEnabled', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'mole:miss', holeIndex: 0 });
    expect(voice.speak).toHaveBeenCalledWith('miss');
    d.stop();
  });

  it('level:complete triggers voice.speak("win") when voiceEnabled', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'level:complete', stats: {} as any });
    expect(voice.speak).toHaveBeenCalledWith('win');
    d.stop();
  });

  it('level:fail triggers voice.speak("lose") when voiceEnabled', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'level:fail', reason: 'lives_exhausted' });
    expect(voice.speak).toHaveBeenCalledWith('lose');
    d.stop();
  });

  it('voice.speak is NOT called when voiceEnabled is false', () => {
    settings = { get: () => ({ sfxEnabled: true, bgmEnabled: true, voiceEnabled: false }) };
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'mole:hit', mole: {} as any, responseMs: 200, tier: 1 });
    bus.emit({ type: 'mole:miss', holeIndex: 0 });
    bus.emit({ type: 'level:complete', stats: {} as any });
    bus.emit({ type: 'level:fail', reason: 'lives_exhausted' });
    expect(voice.speak).not.toHaveBeenCalled();
    d.stop();
  });

  it('voice.speak is called even when sfxEnabled is false (voice independent of SFX)', () => {
    settings = { get: () => ({ sfxEnabled: false, bgmEnabled: true, voiceEnabled: true }) };
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'mole:hit', mole: {} as any, responseMs: 200, tier: 1 });
    expect(audioMock.hitForTier).not.toHaveBeenCalled();
    expect(voice.speak).toHaveBeenCalledWith('hit');
    d.stop();
  });

  it('audio.win is called even when voiceEnabled is false (SFX independent of voice)', () => {
    settings = { get: () => ({ sfxEnabled: true, bgmEnabled: true, voiceEnabled: false }) };
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'level:complete', stats: {} as any });
    expect(audioMock.win).toHaveBeenCalled();
    expect(voice.speak).not.toHaveBeenCalled();
    d.stop();
  });
});
```

- [ ] **Step 3: 运行测试验证通过**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run src/audio/audioDirector.test.ts 2>&1 | tail -15
```

预期: PASS, 16 (原有) + 7 (新) = 23 个测试通过。

- [ ] **Step 4: 全量回归**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npm test 2>&1 | tail -10
```

预期: 157 + 7 = 164 个测试通过。

- [ ] **Step 5: Commit**

```bash
git add src/audio/audioDirector.test.ts
git commit -m "test(audio): add voice routing tests for audioDirector"
```

---

### Task 6: settings page UI 加 voice toggle

**Files:**
- Modify: `src/pages/settings.ts`

(纯 UI 改动,无新单测 — settings.test.ts 测的是 persistence,UI toggle 由现有 readValue 通用逻辑覆盖)

- [ ] **Step 1: 加 voiceEnabled toggle**

修改 `src/pages/settings.ts`,在 `<label class="setting-row">背景音乐</label>` 后插入:

```html
<label class="setting-row">
  <span class="setting-label">猴子配音</span>
  <input type="checkbox" data-key="voiceEnabled" ${s.voiceEnabled ? 'checked' : ''} />
</label>
```

最终顺序 (BGM 之后,虚拟键盘之前):

```html
<label class="setting-row">
  <span class="setting-label">音效</span>
  <input type="checkbox" data-key="sfxEnabled" ${s.sfxEnabled ? 'checked' : ''} />
</label>
<label class="setting-row">
  <span class="setting-label">背景音乐</span>
  <input type="checkbox" data-key="bgmEnabled" ${s.bgmEnabled ? 'checked' : ''} />
</label>
<!-- ← 在这里插入新行 -->
<label class="setting-row">
  <span class="setting-label">猴子配音</span>
  <input type="checkbox" data-key="voiceEnabled" ${s.voiceEnabled ? 'checked' : ''} />
</label>
<label class="setting-row">
  <span class="setting-label">显示虚拟键盘</span>
  <input type="checkbox" data-key="showVirtualKeyboard" ${s.showVirtualKeyboard ? 'checked' : ''} />
</label>
```

- [ ] **Step 2: 编译检查**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx tsc --noEmit 2>&1 | tail -10
```

预期: 0 错误。

- [ ] **Step 3: Commit**

```bash
git add src/pages/settings.ts
git commit -m "feat(settings): add voice toggle UI for voiceEnabled"
```

---

### Task 7: 集成验证 (类型 + build + dev)

- [ ] **Step 1: 类型检查**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx tsc --noEmit 2>&1 | tail -5
```

预期: 0 错误。

- [ ] **Step 2: 全量测试**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npm test 2>&1 | tail -10
```

预期: 164 个测试全部通过。

- [ ] **Step 3: 生产 build**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npm run build 2>&1 | tail -10
```

预期: vite build 成功,无 TS 错误。

- [ ] **Step 4: dev 启动验证**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npm run dev > /tmp/dev.log 2>&1 &
DEV_PID=$!
sleep 4
cat /tmp/dev.log
kill $DEV_PID 2>/dev/null
```

预期: VITE v5.x.x ready in <N>ms, 无 TS 错误。

---

## Stage 4: Manual QA

### Task 8: 手动验证清单

- [ ] **Step 1: 启动 dev server**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npm run dev
```

打开 `http://localhost:5173/#/game?level=1`,进游戏。

- [ ] **Step 2: 验证 7 项清单**

打开浏览器 + 扬声器(或耳机),逐项确认:

- [ ] **2.1** 按对一只 → 听到猴子说"太棒啦!"或类似(任一池中 5 条之一)
- [ ] **2.2** 故意漏掉一只 → 听到"再来一次!"等(同时看到 v2 地鼠气泡 + 下滑音)
- [ ] **2.3** 通关 → 听到"通关啦!"等
- [ ] **2.4** 失败(连续漏 8 只)→ 听到"再来一局!"等
- [ ] **2.5** Settings 关"猴子配音" → 上面 4 个时刻都听不到配音(但 SFX 正常)
- [ ] **2.6** Settings 关"音效"但开"猴子配音" → 只听到配音,不听到 SFX
- [ ] **2.7** 连续按对 5 只 → 不应每只都说(应被 1 秒 rate limit 抑制,最多 2-3 次)

- [ ] **Step 3: 最终 commit (如有调整)**

```bash
git status
# 如果有调整:
git add -A
git commit -m "chore: monkey voice manual QA tweaks"
```

- [ ] **Step 4: 查看 commit 历史**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && git log --oneline -10
```

预期: 看到清晰的 8 个 commit (Task 1-8)。

---

## 完成标准

✅ **功能**:
- 猴子在 4 个时刻随机说中文台词
- Settings `voiceEnabled` 可开关
- v2 地鼠嘲讽保留(视觉 + 下滑音,与配音并存)
- 1 秒 rate limit 防刷屏

✅ **测试**: ~164 个测试全过(原 144 + 新 ~20)
✅ **类型**: `tsc --noEmit` 通过
✅ **build**: `npm run build` 通过
✅ **手动验证**: 7 项清单全部确认

✅ **YAGNI 守住**:
- 没有引入多角色 / 多语言 / 用户自定义 voice
- 没有引入 fallback 路径
- 没有给地鼠加配音 / 给字母加读音

如果某项手动验证不过,回到对应 task 修。**不要**新增 task 做"我刚想到的 cool stuff" — 那是下一版的事。

---

## 关键文件路径速查

| 关注点 | 路径 |
|--------|------|
| TTS 引擎 | `src/audio/speechEngine.ts` |
| 文案池 | `src/speech/monkeyLines.ts` |
| 路由 | `src/audio/audioDirector.ts` |
| Settings | `src/store/slices/settings.ts` + `src/pages/settings.ts` |
| 测试 | `tests/unit/{monkeyLines,speechEngine}.test.ts` + `src/audio/audioDirector.test.ts` |