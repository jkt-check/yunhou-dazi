# 云猴打字 — 猴子配音时机收紧 (Monkey Voice Timing)

**日期**: 2026-06-29
**版本**: v1.0
**状态**: 待用户审核
**目标**: 把猴子配音从"全程 4 个时机 + 多个时机"收紧到"开场 / 末 10s / 通关 / 失败"4 个关键节点,中段 (combo/低命/漏键) 完全静音

---

## 一、动机与目标

### 1.1 为什么做

上一轮 (`2026-06-27-monkey-voice.md` v1.0) 给猴子加了 9 个配音时机,落地后发现:

- **用户反馈**: "猴子说话有点多了,在游戏结束之前说是不是会更好?"
- **实际触发频次** (单局 60s 假设):
  - `monkeyMiss` — 每漏一个就鼓励一次,连漏 3 次就是连续 3 句抱怨
  - `monkeyCombo2/3/4` — 连击阶梯欢呼,运气好能触发 3 次
  - `monkeyLowLife` — 低命时一句(可接受,但和前两个叠加就吵)
- **结果**: 60s 局里能听到 4-7 句猴子话,5-7 岁孩子不是被激励而是被打断

**根因**: 上一轮把"反馈密度 = 爽感"这条 v2 视觉逻辑直接搬到配音上。但视觉特效是 100ms 的粒子或印章,配音是 1-2s 的人声,感官抢占完全不同。

### 1.2 目标

让猴子在 **4 个仪式性节点** 说话,其余时刻 (60s 局里约 50-55s) 完全静音:

| 时机 | 用途 | 现有 kind |
|------|------|-----------|
| 开场 (`level:start`) | 唤起注意 + 定调 | 🆕 `monkeyGreeting` |
| 末 10s (`level:finale`) | 冲刺鼓劲 | `monkeyFinale` (保留) |
| 通关 (`level:complete`) | 庆祝 | `monkeyWin` (保留) |
| 失败 (`level:fail`) | 鼓励再来 | `monkeyLose` (保留) |

### 1.3 非目标 (YAGNI)

- ❌ 不加 settings 开关 (用户明确"全局默认",简化产品面)
- ❌ 不删音频文件 / VOICE_LINES 数据 (保留以备未来重启用,恢复成本 0)
- ❌ 不动地鼠配音 (`moleHit` / `moleTaunt`,那是地鼠不是猴子)
- ❌ 不动 SFX / BGM / ambient / 低命心跳
- ❌ 不做 context-aware 配音 (按关卡 / 场景号变化)
- ❌ 不做多语言 (只中文)

---

## 二、设计

### 2.1 行为改动 — `src/audio/audioDirector.ts`

#### 新增订阅

```ts
unsubs.push(bus.on('level:start', () => {
  if (sfxOn()) audio.playStartJingle();
  if (bgmOn()) audio.startBgm();
  if (ambientOn()) audio.startAmbient();
  if (voiceOn()) voice.speak('monkeyGreeting');  // ← 新增
}));
```

#### 删除语音 (SFX 保留)

| 事件订阅 | 删 | 留 |
|----------|----|----|
| `mole:miss` | `voice.speak('monkeyMiss')` | `audio.miss()` |
| `combo:tier-up` | `voice.speak(cheer)` | `audio.tierUp()` + `audio.setBgmTier(e.tier)` |
| `life:warning` | `voice.speak('monkeyLowLife')` | `audio.setLowLifeMode(true)` |

#### 完全不动

- `mole:hit` → `moleHit` (地鼠惨叫)
- `mole:taunt` → `moleTaunt` (地鼠嘲讽)
- `level:finale` → `monkeyFinale` (末 10s 冲刺)
- `level:complete` → `monkeyWin` (通关)
- `level:fail` → `monkeyLose` (失败)
- 其他所有 SFX / BGM tier 升级 / combo break SFX / achievement unlock SFX

### 2.2 数据改动 — `src/speech/voiceLines.ts`

#### 新增 kind: `monkeyGreeting`

```ts
export type VoiceLineKind =
  | 'monkeyHit'
  | 'monkeyMiss'
  | 'monkeyCombo2'
  | 'monkeyCombo3'
  | 'monkeyCombo4'
  | 'monkeyWin'
  | 'monkeyLose'
  | 'monkeyLowLife'
  | 'monkeyFinale'
  | 'monkeyGreeting'   // ← 新增
  | 'moleHit'
  | 'moleTaunt';

export const VOICE_LINES: Record<VoiceLineKind, readonly VoiceLine[]> = {
  // ... 既有 10 个 kind 不动 ...

  // ── Monkey: 开场白 (5 句池, 拉开节奏) ─────────────────────
  monkeyGreeting: [
    { text: '准备好啦?', voice: 'cute_boy',   emotion: 'excited', speed: 1.0  },
    { text: '开始吧',    voice: 'clever_boy', emotion: 'happy',   speed: 1.0  },
    { text: '来啦',      voice: 'cute_boy',   emotion: 'happy',   speed: 1.05 },
    { text: '冲一冲',    voice: 'cute_boy',   emotion: 'excited', speed: 1.1  },
    { text: '看你的啦',  voice: 'clever_boy', emotion: 'happy',   speed: 1.0  },
  ],

  // ... moleHit / moleTaunt 不动 ...
};
```

**为什么 5 句不是 6/10 句**: 开场白每局 1 句,5 句池 + 随机 `pickLine` → 5 局内大概率不重复。6+ 句对单次性台词是过度设计。

#### 保留 (用户选定"留数据,只删事件订阅")

- `monkeyMiss` / `monkeyCombo2/3/4` / `monkeyLowLife` 在 `VoiceLineKind` union + `VOICE_LINES` 中**全部保留**
- 这与 `monkeyHit` 现状一致(数据全在,代码不订阅 — see `audioDirector.ts:36-37` 注释)
- 不可逆恢复成本: 0 (改回 `voice.speak('monkeyMiss')` 一行)

### 2.3 音频资产

- **新增**: `public/voice/monkeyGreeting/0.mp3` ... `4.mp3` (5 个文件)
- **生成方式**: 跑既有 `scripts/generate-voice-pack.mjs` — 它从 `voiceLines.ts` 读,调 Matrix TTS API,写 mp3 + `manifest.json`。Source-of-truth 是 `voiceLines.ts`,**不需要单独再写 manifest 条目**,脚本会同步生成。
- **未触及**: `monkeyMiss/` / `monkeyCombo2-4/` / `monkeyLowLife/` 等 88 个既有 mp3 文件保留

### 2.4 配置 / 状态

- 无新设置项 (用户选定不加 toggle)
- 无 localStorage schema 变化
- 无成就规则变化
- 无类型破坏性变化 (`VoiceLineKind` union 只加,不改)

---

## 三、测试

### 3.1 `src/audio/audioDirector.test.ts`

| 测试 | 改动类型 | 说明 |
|------|----------|------|
| `level:start` 路由 (line 124-131) | ✏️ 扩展 | 加 `expect(voice.speak).toHaveBeenCalledWith('monkeyGreeting')` |
| `mole:miss 路由 audio.miss` (line 80-85) | — 不动 | SFX 路由未变 |
| `combo:tier-up 路由 audio.tierUp + setBgmTier` (line 101-107) | — 不动 | SFX + BGM 路由未变 |
| voice routing: `combo:tier-up tier 2/3/4` (line 252-271) | 🗑️ 删除 | 不再触发语音 |
| voice routing: `combo:tier-up tier 1 不触发` (line 273-278) | 🗑️ 删除 | 无意义 |
| voice routing: `mole:miss 触发 monkeyMiss` (line 280-285) | 🗑️ 删除 | 不再触发语音 |
| voice routing: `life:warning 触发 monkeyLowLife` (line 309-315) | 🗑️ 删除 | 不再触发语音 |
| voice routing: `voice.speak is NOT called when voiceEnabled is false` (line 324-336) | ✏️ 扩展 | 事件列表加 `level:start`,验证 greeting 也受 voiceEnabled 控制 |
| voice routing: `voice.speak is called even when sfxEnabled is false` (line 338-346) | — 不动 | 只测 `mole:hit` → `moleHit`,该路径保留 |
| voice routing: `audio.win is called even when voiceEnabled is false` (line 348-355) | — 不动 | — |

**净效果**: 既有 39 测试不丢,4 个旧"语音触发"断言删除,1 个新增"开场白触发"断言,1 个 voiceEnabled-off 场景扩 1 个事件。

### 3.2 `tests/unit/voiceLines.test.ts`

| 测试 | 改动类型 | 说明 |
|------|----------|------|
| `ALL_KINDS` 数组 (line 4-8) | ✏️ 扩展 | 数组加 `'monkeyGreeting'` |
| `monkey lines use cute_boy or clever_boy voices` (line 121-131) | ✏️ 扩展 | monkey kinds 列表加 `'monkeyGreeting'` |
| `monkey voice lines` describe 块 | ➕ 新增 | `monkeyGreeting lines use happy/excited emotion (welcoming, not anxious)` |

### 3.3 `tests/unit/speechEngine.test.ts`

| 测试 | 改动类型 | 说明 |
|------|----------|------|
| `fakeManifest.lines` (line 49-55) | ✏️ 扩展 | 加 `monkeyGreeting: [{ file: '/voice/monkeyGreeting/0.m4a', text: '准备好啦!' }]` |

### 3.4 回归覆盖 (确认旧行为不破)

下列既有断言保持绿色即可视为回归通过:
- `mole:miss` 仍触发 `audio.miss()` (SFX)
- `combo:tier-up` 仍触发 `audio.tierUp()` + `audio.setBgmTier(n)` (SFX + BGM 升级)
- `life:warning` (lives ≤ 2) 仍触发 `audio.setLowLifeMode(true)` (心跳 SFX)
- `level:start` 仍触发 `audio.startBgm()` + `audio.startAmbient()` + `audio.playStartJingle()`
- `level:complete` / `level:fail` 仍触发 `audio.win()` / `audio.lose()` + `voice.speak('monkeyWin'/'monkeyLose')`
- `mole:hit` 仍触发 `voice.speak('moleHit')` (地鼠惨叫)
- `mole:taunt` 仍触发 `voice.speak('moleTaunt')` + `audio.taunt()`

---

## 四、风险与权衡

### 4.1 已接受风险

| 风险 | 接受理由 |
|------|----------|
| 漏键 / 连击 / 低命 时刻猴子不再出声 | 用户明确"全局默认,不再问" |
| 5 句开场白 5 局内可能开始重复 | `pickLine` 随机,实际频次可接受;若不够未来可加 |
| TTS 生成新文件依赖 Matrix API | 与既有流程一致 (`generate-voice-pack.mjs`),如失败可手工替换占位 mp3 |

### 4.2 未引入风险

- 无新依赖 / 无新模块
- 无类型破坏性变化 (union 只加)
- 无 localStorage schema 变化
- 无路由 / 渲染 / 输入层改动
- 无视觉改动 (与 v2 视觉系统无关)

---

## 五、范围外 (Out of Scope)

明确不做:
- 把 `monkeyMiss` 等改成"低频触发" (例如每 3 次 miss 一次) — 简单粗暴的"全静音"更符合用户意图
- 给 greeting 加关卡 / 场景 context
- 加 voice 音量 / 音色调节
- 加地鼠 / 字母 / 拼音的配音
- 重写 audioDirector 的事件路由结构 (这是数据/订阅层最小改动,不是重构时机)

---

## 六、成功标准

实施完成后,满足以下任一即视为达成:
1. 跑 `npm test` 全绿,既有 39 测试 + 新增/调整后的测试用例通过
2. 启动 `npm run dev`,进入任一关卡:猴子只在开局说 1 句,中途完全静音,末 10s 听到冲刺词,通关/失败各 1 句
3. 关掉 `voiceEnabled` 时,4 个时机全部静音,SFX/BGM 一切照旧

## 七、参考

- 前置 spec: `2026-06-27-monkey-voice.md` (本改动的反向背景)
- v2 game feel: `2026-06-25-letters-scene-game-feel-v2.md` §1.1 (声音反馈是 5-7 岁孩子"按下一个键就想按下一个键"回路的核心 — 本改动不是否定这条,是重新分配密度)
- 事件类型定义: `src/types/game.ts:49-57`
- 引擎事件发射: `src/core/engine.ts:75-180`
- 配音系统: `src/audio/speechEngine.ts` + `src/speech/voiceLines.ts`
- 音频生成脚本: `scripts/generate-voice-pack.mjs`
