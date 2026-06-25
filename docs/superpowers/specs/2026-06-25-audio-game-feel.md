# 云猴打字 — 音频与游戏感补完

**日期**: 2026-06-25
**状态**: 待用户审核
**目标**: 让游戏从"静默可玩"升级为"有声有色、孩子爱玩"

## 一、动机与现状

### 1.1 用户反馈
> "现在的主要问题是: 基本上没有任何音效, bgm 没有, 击中没有, 失败也没有, 小猴子、地鼠都没有任何音效, 很单调"

### 1.2 现状诊断

`src/audio/audioEngine.ts` 已经实现了 8 个 SFX 方法 (`hit` / `hitForTier` / `miss` / `taunt` / `tierUp` / `combo` / `unlock` / `win` / `lose`),但 `src/pages/game.ts` 只在 3 个事件上订阅了音频 (`achievement:unlocked` / `level:complete` / `level:fail`)。**最常见的游戏瞬间——打中、打飞、被嘲讽、连击升级、连击断了——全部静默**。

| 关键问题 | 后果 |
|---|---|
| `mole:hit` / `mole:miss` / `mole:taunt` / `combo:tier-up` 没接音频 | 主体玩法无声 |
| 没有 BGM | 缺氛围 |
| 没有错键音 | 按错没反馈 |
| `audio.resume()` 只在关卡结束/成就时才调 | 首局第一击可能因浏览器自动播放策略不放声 |
| `bgmEnabled` 字段 (曾因死字段被删) | 没法关音乐,只能全关 |

### 1.3 范围边界

**做**:
- 把所有现有 `audio.*()` 接到对应的 `bus` 事件
- 补 5 个缺失的 SFX (combo break / pop / wrong key / start jingle / pause-resume)
- 引入可循环的 8-bit 风格 BGM
- 新增 `bgmEnabled` 设置 (与 `sfxEnabled` 并列)
- 修首启 AudioContext resume 的潜在 bug
- 改 `key:press` 事件 payload,带 `hasActiveMole` 标记

**不做**:
- 不引入音频文件 (保持程序化合成约束)
- 不引入音频依赖 (tone.js 等)
- BGM 节奏不随 combo 变化 (YAGNI)
- 不重做现有 `audioEngine` 的 blip 算法 (够用)

## 二、架构

### 2.1 文件改动

```
src/
├── audio/
│   ├── audioEngine.ts          ← 扩: 加 5 个 SFX + BGM 能力 + ensureResumed
│   └── audioDirector.ts        ← 新: bus → SFX 路由 + BGM 生命周期
├── store/slices/
│   └── settings.ts             ← 改: 加 bgmEnabled 字段
├── pages/
│   ├── game.ts                 ← 改: 删 3 个 handler,换成 director.start()
│   └── settings.ts             ← 改: 加【背景音乐】勾选框
├── types/game.ts               ← 改: key:press payload 加 hasActiveMole
└── core/engine.ts              ← 改: key:press emit 带 hasActiveMole
```

### 2.2 分层

```
┌──────────────────────────────────────────────┐
│  pages/game.ts                                │
│  ─ 删掉 3 个 bus.on(audio) handler            │
│  ─ 新增 audioDirector.start(bus, settings)     │
│  ─ 离开页面时 audioDirector.stop()             │
└──────────┬───────────────────────────────────┘
           │  bus (GameEvent 全部)
           ▼
┌──────────────────────────────────────────────┐
│  src/audio/audioDirector.ts  (新, ~80 行)     │
│  ─ 翻译 event → audio method                  │
│  ─ 管 BGM 启停 (level:start/end/pause)        │
│  ─ 管 sfxEnabled/bgmEnabled 守门              │
└──────────┬───────────────────────────────────┘
           │  audio.xxx()
           ▼
┌──────────────────────────────────────────────┐
│  src/audio/audioEngine.ts  (扩)               │
│  ─ 新: playWrongKey/playComboBreak/playPop/  │
│         playStartJingle/playPause/playResume │
│  ─ 新: startBgm/stopBgm/pauseBgm/resumeBgm   │
│  ─ 新: play() wrapper, 自动 resume suspended  │
└──────────────────────────────────────────────┘
```

### 2.3 关键决策

1. **audioDirector 不持状态**: 每次 `start()` 拿新 bus, 把 unsub 收集到数组, `stop()` 一次清空。无 leak。
2. **bgmEnabled 重新加回 store**: 之前因"死字段"被删, 这次有 BGM 后它有实际意义, 不算 revert。
3. **audioDirector 是页面级 (持有 bus ref)**: 与现有 `tauntBubble` 处理模式一致, 见 `game.ts:53`。
4. **不引入音频文件**: 保持 CLAUDE.md 约束。

## 三、SFX 清单

| 事件 | audio 方法 | 状态 | 音色 | 频点 | 时长 |
|---|---|---|---|---|---|
| `mole:hit` | `hitForTier(tier)` | 已存在, **新接** | square + tier≥2 加 sine 上八度 | 220/330/440/660 Hz | 120ms |
| `mole:miss` | `miss()` | 已存在, **新接** | sawtooth | 120 Hz | 300ms |
| `mole:taunt` | `taunt()` | 已存在, **新接** | triangle 滑音 440→220 | — | 150ms |
| `combo:tier-up` | `tierUp()` | 已存在, **新接** | sine | 880 Hz | 100ms |
| `combo:reset` | `playComboBreak()` | **新增** | square 滑音 440→110 | — | 250ms |
| `mole:spawn` | `playPop()` | **新增** | sine 短促上扫 | 660→880 Hz | 80ms |
| `key:press` 错键 (有 active) | `playWrongKey()` | **新增** | triangle | 180 Hz | 120ms |
| `key:press` 错键 (无 active) | _静默_ | — | — | — | — |
| `level:start` | `playStartJingle()` | **新增** | sine 三音上爬 | 523/659/784 Hz | 200ms |
| `level:complete` | `win()` | 已存在 | sine 三音 | 784/988/1175 Hz | 450ms |
| `level:fail` | `lose()` | 已存在 | sine 三音下坠 | 392/311/247 Hz | 600ms |
| `achievement:unlocked` | `unlock()` | 已存在 | sine 四音上爬 | 523/659/784/1047 Hz | 400ms |
| `game:pause` | `playPause()` | **新增** | triangle | 330 Hz | 100ms |
| `game:resume` | `playResume()` | **新增** | triangle | 440 Hz | 100ms |

**总计**: 14 cue, 其中 9 已存在 (5 没接 + 4 已接), 5 新增。

## 四、BGM 设计

### 4.1 风格与序列
8-bit 街机风, C 大调, 4 个 8 分音符为一拍, 100 BPM, **方波**主旋律 + sine 下八度低音 root 持续。

**循环乐句** (16 步 = 2 小节 ≈ 3.2s/loop):

```
C5 . E5 G5 . E5 C5 . G4
E5 . G5 C6 . G5 E5 . C5
A4 . C5 E5 . D5 B4 . C5
G4 . A4 B4 . C5 . . .
```

### 4.2 实现
- 预生成 `notes: { timeMs, freq, durationMs, type }[]`
- `startBgm()` 启动 `setInterval(scheduler, 60ms)`, scheduler 推进 cursor, 到点的 note 用 `osc.start(t); osc.stop(t+dur)`
- 不用 `setTimeout` 逐个调 (精度差, 漂移)
- BGM 增益恒定 0.10, 远低于 SFX (0.20-0.40), 不抢戏

### 4.3 生命周期
```
level:start       → startBgm()                     (BGM gain 0.10, 之后受 volume 滑块乘)
game:pause        → pauseBgm()                     (BGM gain 0.10 → 0, linearRamp 200ms)
game:resume       → resumeBgm()                    (BGM gain 0 → 0.10, linearRamp 200ms)
level:complete    → stopBgm() (立即) + audio.win()  (顺序: 先停 BGM, 再放 win; 间隔 0ms)
level:fail        → stopBgm() (立即) + audio.lose() (顺序: 先停 BGM, 再放 lose; 间隔 0ms)
unmount           → stopBgm() + clearInterval(scheduler)
```

**音量模型**: `masterGain.value = settings.volume` (现有); BGM 有独立的 `bgmGain` 节点, 恒定 0.10; `bgmGain` 通过 `masterGain` 输出。最终听到的 BGM 音量 = `volume × 0.10`。SFX 不用 `bgmGain`, 直接接 `masterGain`, 音量 = `volume × cue音量`。

## 五、Settings 集成

### 5.1 `src/store/slices/settings.ts`
```ts
interface SettingsState {
  volume: number;        // 0-1, 不变
  sfxEnabled: boolean;   // 不变
  bgmEnabled: boolean;   // 新增, 默认 true
  showVirtualKeyboard: boolean;
  theme: 'default' | 'sepia' | 'ink';
}

const DEFAULTS = {
  volume: 0.7,
  sfxEnabled: true,
  bgmEnabled: true,       // 新增
  showVirtualKeyboard: true,
  theme: 'default' as const,
};
```

persistence middleware 不动 (走 `Object.keys(state)` 自动包含新字段)。

### 5.2 `src/pages/settings.ts`
在【音效】勾选框下面加【背景音乐】勾选框。复用 `data-key="bgmEnabled"` 模式, 现有 `readValue` 已能处理 boolean。

## 六、关键修复

### 6.1 AudioContext resume bug
**问题**: 浏览器自动播放策略下 AudioContext 初始 suspended, 需用户交互后才能 resume。当前只在 `level:complete|fail|achievement` 调, **首局第一击** 时 ctx 还 suspended, 听不到 hit 音。

**修法**: `audioEngine` 内部加 `play()` wrapper, 任何公开 SFX 方法都走它:
```ts
private play(fn: () => void) {
  this.ensure();
  if (this.ctx?.state === 'suspended') this.ctx.resume();
  fn();
}
```

每个 SFX 公开方法 (`hit` / `hitForTier` / `miss` / `taunt` / `tierUp` / `combo` / `unlock` / `win` / `lose` + 5 个新增) 改成 `this.play(() => { ... 现有 blip 代码 ... })`。**惰性 resume**, 不需要单独的"激活"步骤。BGM 的 `startBgm` 也走 `play()`, 同理处理。

### 6.2 key:press 与 mole:hit 缺信息
**问题 1 (key:press)**: 错键分两种: (a) 场上没地鼠, 不应出声; (b) 场上有地鼠, 应给柔和提示。当前 `engine.handleKey` 不区分。

**问题 2 (mole:hit)**: `audioDirector` 调 `hitForTier(tier)` 需要 tier 值。当前 `mole:hit` payload 只有 `mole` 和 `responseMs`, director 不得不读 `gameStore.comboTier`。可以让 director 只听 event, 不读 store。

**修法 (key:press)**:
1. `engine.ts:97` emit 时计算并带上 `hasActiveMole`:
   ```ts
   const hasActive = this.currentMoles.some(m => m.state === 'active' || m.state === 'rising');
   this.hooks.bus.emit({ type: 'key:press', key, hasActiveMole: hasActive });
   ```
2. `GameEvent` 类型扩 `key:press` payload 加 `hasActiveMole: boolean`。
3. `audioDirector` 订阅时按 `hasActiveMole` 决定响不响。

**修法 (mole:hit)**:
1. `engine.ts:107` emit 时带 `tier`:
   ```ts
   const tier = comboTier(newCombo);
   this.hooks.bus.emit({ type: 'mole:hit', mole: target, responseMs, tier });
   ```
2. `GameEvent` 类型扩 `mole:hit` payload 加 `tier: 1|2|3|4`。
3. `audioDirector` 直接用 `tier` 调 `audio.hitForTier(tier)`, 不读 store。

## 七、测试策略

### 7.1 新增/改动测试

| 文件 | 类型 | 覆盖 |
|---|---|---|
| `src/audio/audioDirector.test.ts` | 新 | 路由映射、enable 守门、stop 清理 |
| `src/audio/audioEngine.test.ts` | 新 | 5 个新 SFX 不崩、BGM 调度 |
| `src/store/slices/settings.test.ts` | 改 | DEFAULTS 含 bgmEnabled, persistence 往返 |
| `src/core/engine.test.ts` (如有) | 不动 | — |

### 7.2 audioDirector 单测关键 case
- `mole:hit` → `audio.hitForTier(tier)` 被调
- `combo:reset` → `audio.playComboBreak()` 被调
- `key:press` + `hasActiveMole: true` → `audio.playWrongKey()`
- `key:press` + `hasActiveMole: false` → 不调
- `level:start` → `audio.startBgm()`
- `level:complete` → `audio.stopBgm()` + `audio.win()`
- `level:fail` → `audio.stopBgm()` + `audio.lose()`
- `sfxEnabled: false` → SFX 不调, BGM 仍 start
- `bgmEnabled: false` → BGM 不 start, SFX 仍响
- `stop()` → 所有订阅 unsub

### 7.3 手工验收清单
- [ ] 第一次按对键, 声音立即响
- [ ] 错键 (有 active 地鼠) 听到柔和 thump
- [ ] 错键 (无地鼠) 静默
- [ ] 关卡开始听到 jingle + BGM 起
- [ ] 连击断听到下沉音
- [ ] tier 升级听到高音 ping
- [ ] 通关/失败 BGM 立即停, 听到对应结束音
- [ ] 设置关【音效】, 所有 SFX 静默, BGM 也停
- [ ] 设置关【背景音乐】, 只有 BGM 停, SFX 正常
- [ ] 暂停游戏 BGM 渐弱到 0, 恢复后渐回
- [ ] 浏览器刷新后设置保留

## 八、风险与回滚

| 风险 | 缓解 |
|---|---|
| 8-bit 风格与中式书+印章美术不搭 | 用户明确选择 8-bit, 不二次质疑 |
| BGM 调度漂移 | 用 `setInterval(60ms)` 推进 cursor, 不依赖 setTimeout |
| 多个 SFX 同时触发 ctx 报错 | 现有 engine 已通过 `play()` wrapper 模式, 沿用即可 |
| 浏览器音量策略变化 | `play()` wrapper 内 `ctx.resume()` 每次都试一次, 失败吞错 |
| bgmEnabled 字段加入破坏老用户 localStorage | persistence middleware 用 `Object.keys` + 默认值合并, 新字段用默认值 |

回滚: 单个 commit, 一次 revert 即可恢复"无声"状态。

## 九、不在范围

- BGM 节奏随 combo 变化 (YAGNI)
- 主题音乐 (按场景区分 BGM) (YAGNI, 只有 letters 一个场景)
- 击键时按字母表音高变化 (YAGNI, 已经有 tier-based 变化)
- 空间音效 (3D 定位) (Web Audio API 复杂, YAGNI)
- 替换 audioEngine 为 tone.js (不引入依赖)
