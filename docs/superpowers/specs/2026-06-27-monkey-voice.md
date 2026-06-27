# 云猴打字 — 猴子中文配音 (Monkey Voice)

**日期**: 2026-06-27
**版本**: v1.0
**状态**: 待用户审核
**目标**: 让猴子在关键游戏时刻"开口"说中文鼓励语 / 台词,提升 5-7 岁孩子的参与感

---

## 一、动机与目标

### 1.1 为什么做

v2 Letters 场景 Game Feel 重塑后,孩子玩游戏的"爽感"已经有了:
- Combo 4 档分级反馈 + 粒子 + 印章 + 浮动 +分
- 地鼠嘲讽 (漏掉时 squint + 气泡 + 下滑音)
- 3 星评级 + 猴子 5 态 (idle/hit/combo/taunt/miss)

但用户反馈:**"小地鼠和小猴子还是一句话也不说"**。

虽然 v2 有 taunt 文案(漏掉时显示在气泡里),但:
1. 是**地鼠**嘲讽,**猴子**全程沉默
2. 嘲讽是**视觉文字**,不是**听觉人声** — 5-7 岁孩子对声音更敏感
3. 命中、通关、失败三个关键节点猴子没有任何反馈

按 v2 spec §1.1:"5-7 岁孩子按下第一个键的瞬间就想按下一个键" — **声音反馈是这条回路的核心**。

### 1.2 目标用户

- **年龄**: 5-7 岁
- **场景**: 桌面 + 家长陪同(已确认)
- **频次**: 每天多局,单局 60 秒
- **关键约束**: 不依赖长篇文字,声音 + 视觉是主要反馈通道

### 1.3 范围边界

**做**:
- ✅ 猴子在 4 个时刻随机说 3-5 词中文鼓励语 / 台词:
  - 命中(`mole:hit`)→ 鼓励
  - 漏掉(`mole:miss`)→ 鼓励
  - 通关(`level:complete`)→ 庆祝
  - 失败(`level:fail`)→ 鼓励再来
- ✅ 使用浏览器内置 Web Speech API (`SpeechSynthesis`)
- ✅ `settings.voiceEnabled` 开关(默认 true)
- ✅ v2 地鼠嘲讽(漏掉时 squint + 气泡 + 下滑音)**完整保留**,与猴子配音并存

**不做** (YAGNI):
- ❌ 地鼠出声 / 字母读音 / 拼音读音(用户明确否决)
- ❌ 角色选择(只有猴子,无双角色系统)
- ❌ 用户可改的 voice 配置(音色 / rate / pitch 由代码固定)
- ❌ 多语言支持(只中文)
- ❌ 配音历史 / 字幕显示 / 配音队列 UI
- ❌ Fallback 到程序化合成(浏览器不支持直接 silent,不写 fallback 路径)

### 1.4 与 BGM 修复的关系

上一轮已修 BGM(A9ca89c)。本次改动不影响 BGM 路径,但**两个修复叠加**让 audioDirector 的整个事件→声音路由完整闭环。

---

## 二、整体设计

### 2.1 触发链路

```
玩家按键命中/漏掉
    ↓
engine.handleKey / engine.tick
    ↓ emit bus event
EventBus (mole:hit | mole:miss | level:complete | level:fail)
    ↓ on subscribe
audioDirector 路由:
    ├─ sfxOn() → audio.hitForTier(tier) / miss / win / lose
    └─ voiceOn() → voice.speak(line)        ← 新增
    ↓
speechEngine 调用 SpeechSynthesis.speak()
    ↓
浏览器 TTS 引擎发出中文人声
```

### 2.2 文案池 (src/speech/monkeyLines.ts)

| 场景 | 中文台词 | 数量 |
|------|---------|------|
| 命中 (hit) | "太棒啦!" / "打中啦!" / "真准!" / "好厉害!" / "再来一个!" | 5 |
| 漏掉 (miss) | "再来一次!" / "别灰心!" / "加油加油!" / "差一点!" / "下次一定行!" | 5 |
| 通关 (win) | "通关啦!" / "太厉害啦!" / "满分!" / "你是打字小高手!" / "完美收官!" | 5 |
| 失败 (lose) | "再来一局!" / "加油!" / "下次一定行!" / "别灰心哦~" / "再来一次!" | 5 |

总计 20 条。所有文案在设计前 QA 过 — 5-7 岁孩子易理解、积极正面、无负面情绪词。

### 2.3 TTS 配置 (固定,用户不可改)

```typescript
const TTS_CONFIG = {
  lang: 'zh-CN',         // 中文(简体)
  rate: 0.95,            // 比正常略慢,孩子易懂
  pitch: 1.1,            // 略高,活泼
  volume: 0.85           // 核心反馈通道,稍大
};
```

**音色选择**: 调用 `window.speechSynthesis.getVoices()` 找第一个 `lang === 'zh-CN'` 的 voice,找不到就用浏览器默认(浏览器会回落到系统 TTS,通常仍是中文)。

---

## 三、模块边界与文件改动

### 3.1 新建文件

```
src/
├── audio/
│   └── speechEngine.ts        🆕 封装 SpeechSynthesis API
└── speech/
    └── monkeyLines.ts         🆕 文案池 + pickLine(kind)
```

### 3.2 修改文件

```
src/
├── audio/
│   ├── audioDirector.ts       🔧 加 voiceEnabled 路由 + 4 个 voice 调用
│   └── audioDirector.test.ts  🔧 加 voice 路由测试
├── store/slices/
│   └── settings.ts            🔧 + voiceEnabled 字段 + 默认 true
└── pages/
    └── settings.ts            🔧 + voice toggle checkbox
```

### 3.3 不动

- `src/audio/audioEngine.ts` — 程序化 SFX,与 TTS 不混
- `src/render/sprites/mole.ts` + `src/render/sprites/monkey.ts` — v2 视觉不变
- `src/scenes/letters.ts` — `getTauntText()` 仍由地鼠嘲讽使用
- `src/core/engine.ts` — 不 emit 新事件

### 3.4 关注点分离

| 关注点 | 归属 | 不应进入 |
|--------|------|---------|
| TTS 调用、rate limit、cancel | `speechEngine.ts` | audioEngine / audioDirector / scenes |
| 文案池 (数据) | `monkeyLines.ts` | speechEngine / audioDirector |
| 事件→声音路由 | `audioDirector.ts` | speechEngine |
| Settings (用户开关) | `settingsStore` | speechEngine(只读) |
| Settings UI | `pages/settings.ts` | settingsStore 逻辑 |

---

## 四、组件设计

### 4.1 SpeechEngine

```typescript
// src/audio/speechEngine.ts
export type VoiceLineKind = 'hit' | 'miss' | 'win' | 'lose';

export interface VoiceEngine {
  speak(kind: VoiceLineKind): void;   // 随机选一条 line + 触发 SpeechSynthesis
  cancel(): void;                     // 打断当前说话(防止高频刷屏)
  setEnabled(enabled: boolean): void; // 程序化开关(settings 变化时调用)
  isSupported(): boolean;             // 浏览器是否支持 SpeechSynthesis
}

class SpeechEngineImpl implements VoiceEngine {
  private enabled = true;
  private lastSpeakAt = 0;
  private minIntervalMs = 1000;  // 1 秒内不重复触发(防止连续命中的配音刷屏)

  speak(kind: VoiceLineKind): void {
    if (!this.enabled) return;
    if (!this.isSupported()) return;

    const now = performance.now();
    if (now - this.lastSpeakAt < this.minIntervalMs) return;
    this.lastSpeakAt = now;

    const line = pickLine(kind);
    const u = new SpeechSynthesisUtterance(line);
    u.lang = TTS_CONFIG.lang;
    u.rate = TTS_CONFIG.rate;
    u.pitch = TTS_CONFIG.pitch;
    u.volume = TTS_CONFIG.volume;
    const voice = pickZhCnVoice();
    if (voice) u.voice = voice;

    // 打断正在说的上一句,避免叠加
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  cancel(): void {
    window.speechSynthesis.cancel();
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
  const voices = window.speechSynthesis.getVoices();
  return voices.find(v => v.lang === 'zh-CN') ?? null;
}

export const voice = new SpeechEngineImpl();
```

**关键决策**:
- `minIntervalMs = 1000`: 防止连续命中(每次命中都触发)的配音刷屏
- `cancel() before speak()`: 短句打断长句,体验更自然
- `isSupported()`: 测试可断言,生产环境 SSR-safe

### 4.2 monkeyLines

```typescript
// src/speech/monkeyLines.ts
import { randIndex } from '@/utils/random';
import type { VoiceLineKind } from '@/audio/speechEngine';

const LINES: Record<VoiceLineKind, readonly string[]> = {
  hit:  ['太棒啦!', '打中啦!', '真准!', '好厉害!', '再来一个!'],
  miss: ['再来一次!', '别灰心!', '加油加油!', '差一点!', '下次一定行!'],
  win:  ['通关啦!', '太厉害啦!', '满分!', '你是打字小高手!', '完美收官!'],
  lose: ['再来一局!', '加油!', '下次一定行!', '别灰心哦~', '再来一次!']
};

export function pickLine(kind: VoiceLineKind): string {
  const pool = LINES[kind];
  return pool[randIndex(pool.length)];
}
```

纯数据 + 一个 pick 函数。复用现有 `randIndex` (确保 clamp 边界)。

### 4.3 audioDirector 加 voice 路由

```typescript
// src/audio/audioDirector.ts  (现有文件,加 4 行)
import { voice } from './speechEngine';

export interface SettingsReader {
  get(): { sfxEnabled: boolean; bgmEnabled: boolean; voiceEnabled: boolean };  // ← + voiceEnabled
}

// 内部
const sfxOn = () => settings.get().sfxEnabled;
const bgmOn = () => settings.get().bgmEnabled;
const voiceOn = () => settings.get().voiceEnabled;

// 现有路由,加 voice 调用:
unsubs.push(bus.on('mole:hit', (e) => {
  if (sfxOn()) audio.hitForTier(e.tier);
  if (voiceOn()) voice.speak('hit');   // ← 新增
}));

unsubs.push(bus.on('mole:miss', () => {
  if (sfxOn()) audio.miss();
  if (voiceOn()) voice.speak('miss');  // ← 新增
}));

unsubs.push(bus.on('level:complete', () => {
  audio.stopBgm();
  if (sfxOn()) audio.win();
  if (voiceOn()) voice.speak('win');   // ← 新增
}));

unsubs.push(bus.on('level:fail', () => {
  audio.stopBgm();
  if (sfxOn()) audio.lose();
  if (voiceOn()) voice.speak('lose');  // ← 新增
}));
```

**注意**: 不要把 voice.speak 放在 `voiceOn()` 之外的路径 — 现有 audio.win()/audio.lose() 没有 `if (sfxOn())` 守卫,但有 stopBgm() 调用。这次**保留**这个不对称(stopBgm 不受 sfxEnabled 控制),voice 严格跟 voiceEnabled。

### 4.4 Settings 加 voiceEnabled

```typescript
// src/store/slices/settings.ts
export interface SettingsState {
  // ... 现有字段
  voiceEnabled: boolean;        // ← 新增
}

const initial: SettingsState = {
  // ... 现有
  voiceEnabled: true            // ← 默认开
};

// persistence whitelist 也加:
whitelist: ['volume', 'sfxEnabled', 'bgmEnabled', 'voiceEnabled', 'showVirtualKeyboard', 'theme']
```

```html
<!-- src/pages/settings.ts 加一个 toggle,和 bgmEnabled 同款 -->
<label class="setting-row">
  <span class="setting-label">猴子配音</span>
  <input type="checkbox" data-key="voiceEnabled" ${s.voiceEnabled ? 'checked' : ''} />
</label>
```

---

## 五、错误处理与边界

| 情况 | 处理 |
|------|------|
| 浏览器不支持 SpeechSynthesis | `isSupported()` 返回 false → `speak()` no-op |
| 没找到 zh-CN voice | 用浏览器默认 voice (TTS 引擎回落到系统中文) |
| 连续命中/漏掉 | `minIntervalMs = 1000` 抑制;期间 cancel 之前的短句 |
| 用户禁用了 voiceEnabled | `setEnabled(false)` → `cancel()` + 后续 speak no-op |
| SpeechSynthesis 内部错误 (罕见) | 浏览器静默,不需要 catch |
| 用户首次进游戏没按键就 level:complete | 不可能 — complete 必须先有 hit |
| SSR / Node 环境 | `typeof window === 'undefined'` 守卫,`isSupported()` 返回 false |
| 测试环境 (jsdom) | `speechSynthesis` 不存在,isSupported 返回 false,speak no-op |

**没有** "speech 失败重试" / "speech 错误上报" — YAGNI,浏览器 TTS 失败就该 silent。

---

## 六、测试策略

### 6.1 单元测试 (Vitest + happy-dom)

| 测试 | 文件 | 覆盖 |
|------|------|------|
| `pickLine()` 返回字符串 | `monkeyLines.test.ts` | 每种 kind 都返回非空字符串 |
| `pickLine()` 长度 = 池大小 | `monkeyLines.test.ts` | 100 次抽样,所有 5 条都出现过 |
| `pickLine('hit')` 不返回 'miss' 池内容 | `monkeyLines.test.ts` | 边界检查 |
| `voice.speak()` no-op when unsupported | `speechEngine.test.ts` | mock 掉 window.speechSynthesis |
| `voice.speak()` respects rate limit | `speechEngine.test.ts` | 连续 2 次 speak,第二次被抑制 |
| `voice.setEnabled(false)` cancels current | `speechEngine.test.ts` | mock cancel,验证被调用 |
| `pickZhCnVoice()` 选 zh-CN | `speechEngine.test.ts` | mock getVoices 返回多个 lang |

### 6.2 集成测试 (audioDirector)

| 测试 | 覆盖 |
|------|------|
| `mole:hit` → `voice.speak('hit')` 被调用 | 路由 |
| `mole:miss` → `voice.speak('miss')` 被调用 | 路由 |
| `level:complete` → `voice.speak('win')` 被调用 | 路由 |
| `level:fail` → `voice.speak('lose')` 被调用 | 路由 |
| `voiceEnabled: false` → `voice.speak` 不被调用 | 开关 |
| `sfxEnabled: false` 但 `voiceEnabled: true` → SFX 不响但 voice 响 | 解耦 |

### 6.3 测试数量目标

- 当前: 144 个测试
- 新增: ~10 个 (monkeyLines 3 + speechEngine 4 + audioDirector 4)
- 目标: **~154 个**

### 6.4 手动验证清单

- [ ] 进游戏, 按对一只 — 听到"太棒啦!"或类似
- [ ] 故意漏掉一只 — 听到"再来一次!"或类似(同时看到 v2 地鼠气泡 + 下滑音)
- [ ] 通关 — 听到"通关啦!"或类似
- [ ] 失败 — 听到"再来一局!"或类似
- [ ] Settings 关闭"猴子配音" → 上面四个时刻都听不到声音(但 SFX 正常)
- [ ] Settings 关闭"音效"但开启"猴子配音" → 只听到配音
- [ ] 连续按对 5 只 — 不应每只都说(应被 rate limit 抑制)

---

## 七、风险与权衡

| 风险 | 影响 | 缓解 |
|------|------|------|
| Chrome TTS 中文质量差 | 中等 | 现状 — Chrome 的 zh-CN 是 Google TTS,质量可接受 |
| Safari/Firefox TTS 中文不行 | 中等 | `pickZhCnVoice()` fallback 到浏览器默认,接受参差 |
| 配音太频繁吵到孩子 | 中等 | `minIntervalMs = 1000` rate limit |
| 配音和 SFX 同时响混乱 | 低 | SpeechSynthesis 优先级高于 SFX 听感;不额外 mix |
| SpeechSynthesis API 行为不一致 | 中等 | mock 严格测核心方法,手动测听觉 |
| 用户想换 voice | 低 | YAGNI,后续可加 |
| 用户想英文配音 | 低 | YAGNI,后续可加 |

---

## 八、开发顺序 (Stage 1-3)

### Stage 1: 数据层 + 配置
1. `src/speech/monkeyLines.ts` + 测试
2. `src/store/slices/settings.ts` 加 `voiceEnabled`
3. `src/pages/settings.ts` 加 toggle

### Stage 2: 引擎层
4. `src/audio/speechEngine.ts` + 测试
5. `src/audio/audioDirector.ts` 加 4 个 voice 路由 + 更新 `SettingsReader` 接口

### Stage 3: 整合 + 验证
6. `src/audio/audioDirector.test.ts` 加 voice 路由测试
7. 全量测试 + dev 启动手动验证

---

## 九、YAGNI 决策记录

| 项 | 决策 | 原因 |
|----|------|------|
| 地鼠出声 | 不做 | 用户明确否决 |
| 字母读音 | 不做 | 用户明确否决 |
| 角色选择 (多角色) | 不做 | 单角色足够,后续可加 |
| 用户自定义 voice | 不做 | TTS 配置固定,降低 UI 复杂度 |
| 多语言 | 不做 | 只服务中文用户 |
| Fallback 到程序化合成 | 不做 | 浏览器不支持就 silent,YAGNI |
| 配音历史 / 字幕 | 不做 | 简单反馈,无需历史 |
| 配音队列 UI | 不做 | 内部 cancel() 已够用 |

---

## 十、关键文件路径速查

| 关注点 | 路径 |
|--------|------|
| TTS 引擎 | `src/audio/speechEngine.ts` |
| 文案池 | `src/speech/monkeyLines.ts` |
| 路由 | `src/audio/audioDirector.ts` |
| Settings | `src/store/slices/settings.ts` + `src/pages/settings.ts` |
| 测试 | `tests/unit/{monkeyLines,speechEngine}.test.ts` + `src/audio/audioDirector.test.ts` |