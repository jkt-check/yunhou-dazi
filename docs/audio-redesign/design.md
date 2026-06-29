# 云猴打字 — 声音整体优化设计方案

> 现状诊断 + 重设计 + 实施 roadmap
>
> 适用范围: `src/audio/` 全部 + `src/speech/voiceLines.ts` + `scripts/generate-voice-pack.mjs`
> 目标: 让游戏有"听得到的故事感",而不是一串电子哔哔声

---

## 一、现状诊断(为啥现在听着没意思)

### 1.1 SFX 层 —— `src/audio/audioEngine.ts`

| 问题 | 证据 | 影响 |
|------|------|------|
| **全是裸波形** | 整文件只有 `sine / square / triangle / sawtooth` 四种 OscillatorType | 听感都是"电子蜂鸣器",没有"打地鼠"该有的泥土/木头质感 |
| **没分层混响** | 所有 SFX 直接挂 master,跟 BGM 同一条总线硬抢响度 | 一打中,BGM 听不清;打错键又是另一个频段的"哒哒哒",耳朵累 |
| **没 ducking** | BGM 是 0.10 固定音量,voice 是 0.85 固定音量,SFX 是 0.18~0.45 | 命中瞬间三者叠加爆音,没有"主角突出、配角退让"的层次 |
| **没随机微变** | 每个 blip 频率 / 长度写死,听 5 次和第 50 次一模一样 | 大脑识别为"机械",失去惊喜感 |
| **白噪声缺席** | 全文件零 `AudioBufferSourceNode` 用 noise buffer | 缺少"砸到实物"的爆破感 (木鱼/竹筒/鼓),这是打地鼠最关键的听觉签名 |
| **没滤波器** | 全文件零 `BiquadFilter` | 高频刺耳、低频浑浊;真实世界的声音几乎都经过滤波器塑形 |

### 1.2 BGM 层 —— `audioEngine.ts:241-279`

| 问题 | 证据 | 影响 |
|------|------|------|
| **单音色独奏** | 32 个音符全用 `square` 波,100 BPM,8-bit 风 | 和"故事书 + 中式印章"的视觉调性完全对不上 |
| **无动态** | 不管 combo tier / 玩家状态,从头到尾一模一样 | 失去"紧张感上升"的反馈环 |
| **旋律单一** | 32 步全是 C 大调上行下行的同一段循环 | 听 2 遍就腻,没有"主题→变奏→高潮" |
| **没低频支撑** | 最低音符 392 Hz (G4) | 没有 bass line,声音飘在空中 |
| **无打击乐** | 节奏感全靠主旋律承担 | 缺少心跳感 |

### 1.3 Voice 层 —— `src/speech/` + `scripts/generate-voice-pack.mjs`

| 问题 | 证据 | 影响 |
|------|------|------|
| **每 kind 只有 5 句** | `voiceLines.ts:18-29` 全部 hardcoded 5 条 | 连击到 10 连还在重复"再来一个",游戏中期听觉疲劳 |
| **无情感维度** | 用 macOS `say` 命令,情感靠"~~~~"标点符号模拟 | "哎呦呦!" 和 "疼啊~~~~" 听感差距小,没有情绪曲线 |
| **音色选择过窄** | 整个游戏只用 2 个 macOS TTS 音色 (Eddy / Flo) | monkey 和 mole 的"人物感"被压平 |
| **无 tier 分级台词** | combo tier-up 只复用普通 hit 句 | 玩家"连击上分"的高光时刻被浪费 |
| **没空间感** | 全部 `playback.volume = 0.85` 固定 | 不知道哪个洞的 mole 在叫 |

### 1.4 系统级问题

| 问题 | 证据 | 影响 |
|------|------|------|
| **环境音 = 0** | 整个 `audio/` 目录找不到任何 ambient/bed | 游戏"没有场景感",玩家感觉在听一串音效不是在一个场景里 |
| **没转场音效** | 暂停→恢复 / 关卡开始 / 通关瞬间只是 1~2 音符 blip | 关键节点的"仪式感"缺失 |
| **三级音量混合硬编码** | master 0.7 / BGM 0.10 / SFX 0.18~0.45 / voice 0.85 | 没有 "BGM 让位给 voice" 的自动 ducking |
| **错误输入反馈太轻** | `playWrongKey` 是 180Hz triangle blip,0.18 音量 | 玩家分不清"按错"和"啥都没发生" |

---

## 二、新设计 — 分层架构 + 角色化 + 动态反应

### 2.1 4 层音频架构 (L0~L3)

```
┌────────────────────────────────────────────────────┐
│ L3 Voice (TTS)        gain 0~1, ducked by SFX      │ ← 主角
├────────────────────────────────────────────────────┤
│ L2 SFX (事件)         gain 0~1, ducked during voice│ ← 强调
├────────────────────────────────────────────────────┤
│ L1 BGM (动态)         gain 0.05~0.18, auto-duck    │ ← 底色
├────────────────────────────────────────────────────┤
│ L0 Ambient (场景底)   gain 0.04, 全程 loop          │ ← 氛围
└────────────────────────────────────────────────────┘
       ↑
   master gain (settings.volume)
```

**关键约束: 4 层都有独立 GainNode**,在 audioEngine 内部连成 4 通道总线,master 在最外层。SFX 触发时自动 ramp BGM down 0.4x 持续 200ms 然后恢复;Voice 触发时 BGM ramp 到 0.3x。这是"听感有层次"的核心机制。

### 2.2 L0 Ambient 层 (新增)

```
character: 低频风噪 + 远处鸟鸣 + 竹叶沙沙 + 偶尔一声蟋蟀
synthesize: 1) BufferSourceNode 循环播放一段 30s 的 noise
            2) BiquadFilter (lowpass 800Hz) 塑形
            3) 偶发 sprite: 2500~3500Hz sine 短 blip (鸟)
loop: 30 秒无缝循环
volume: 0.04 (很轻,只是"空气感")
开关: 与 BGM 同 (settings.bgmEnabled)
```

**为什么**: 没有 ambient = 没有"在一个地方玩"的感觉。这层最重要,它定调"故事书 + 竹林/田园"。

### 2.3 L1 BGM 层 (重写)

**当前**:`audioEngine.ts:241-279` 32 步 8-bit square 单线旋律
**改成**:**3 套主题 + 实时分层响应**

#### 主题 A: 竹林清晨 (Level 1-2 默认)

```
prompt: Gentle Chinese pentatonic children BGM, soft guzheng plucking,
        warm bamboo flute pad, light woodblock tick, 90 BPM, 30s loop
```
- 旋律线: 五声音阶 (C D E G A) 8 小节循环
- 配器: 合成 sine 高八度主旋律 + triangle 低音 pad + 偶发木鱼 (filter noise burst)
- 4 通道: melody / bass / pad / tick (4 个独立 gain,各自开关)

#### 主题 B: 锣鼓欢腾 (Level 3 / 高 combo 状态)

```
prompt: Energetic Chinese pentatonic kids game BGM, fast guzheng melody,
        bouncing erhu countermelody, playful woodblock percussion, 120 BPM
```
- 同主题 A 基础 + 加快节奏 + 加鼓点 + 加副旋律

#### 主题 C: 紧张冲刺 (低血量/终局)

```
prompt: Tense Chinese erhu tremolo building, fast woodblock heartbeat, 130 BPM
```
- 同主题 A 但砍掉 melody,只保留 bass + tick + heartbeat (加速)

#### 动态响应机制

```
game state         →  BGM 内部通道开关
─────────────────────────────────────────
combo tier = 1     →  仅 melody + pad
combo tier = 2     →  + bass 进入
combo tier = 3     →  + tick 加大,加副旋律
combo tier = 4     →  + 打击乐鼓点,整体 gain 提升 20%
lives ≤ 2          →  切到 Theme C (heartbeat 模式)
last 10s 倒计时   →  tick 加速 2x
level:complete     →  渐弱 + 接 win fanfare
level:fail         →  切 minor 主题 + 渐弱
```

**实现**: BGM 不再是单一音符数组,而是 4 个独立 Track 的合成器,每个 track 有自己的 notes 数组 + gain,combo tier 触发"开启/关闭某 track"并做 400ms gain ramp。

### 2.4 L2 SFX 层 — 角色化 + 物理感重塑

**核心原则: 每个 SFX 都要听起来像"实物碰撞"或"自然界声响",而不是电子波。**

#### SFX 设计总表

| 触发事件 | 当前实现 | 新设计 | 音色签名 |
|---------|---------|--------|----------|
| **mole:hit** (打中) | `moleHit()` sawtooth 800→180Hz 250ms | **木槌敲土**: <br>1. Lowpass-filtered white noise burst 30ms (土爆开) <br>2. Sine 220Hz → 110Hz 80ms (重音) <br>3. Triangle 600Hz 衰减 60ms (木槌回弹) | 听感:"咚~啪" |
| **mole:hit tier≥2** | `hitForTier()` square 220~660Hz | 在 mole:hit 基础上加 triangle 880Hz 短闪 (亮点) | tier 越高越"亮" |
| **mole:spawn** (地鼠钻出) | `playPop()` sine 660→880Hz 80ms | **竹筒弹起**: <br>1. Triangle 800→1400Hz 60ms (弹起) <br>2. Filtered noise 100Hz→40Hz 100ms (土松动) | 听感:"啵~噗" |
| **mole:taunt** (嘲讽) | `taunt()` square 200→440 + triangle 440→220 | **口哨嘲笑**: <br>1. Triangle 700→500Hz 120ms (下挫) <br>2. 间隔 80ms 后短 whistle 900→600Hz 60ms (二次嘲) | 听感:"呦~嘻嘻" |
| **mole:miss** (漏掉) | `miss()` sawtooth 120Hz 300ms | **叹气**: <br>1. Sine 220→140Hz 400ms (低叹) <br>2. 加 1kHz LP noise 80ms (风) | 听感:"唉..." |
| **combo:tier-up** | `tierUp()` sine 880Hz 100ms | **风铃**: <br>1. Sine 1320Hz 30ms <br>2. 间隔 50ms 后 sine 1760Hz 20ms <br>3. 再间隔 50ms sine 2093Hz 15ms (上升三次泛音) | 听感:"叮铃~" |
| **combo:reset** | `playComboBreak()` square 440→110Hz | **破音**: triangle 330→80Hz 300ms + LP noise 200ms (像气球漏气) | 听感:"嘶——" |
| **key:press wrong** | `playWrongKey()` triangle 180Hz 120ms | **软木头**: triangle 240Hz 60ms + LP noise 50ms (短"笃") | 听感:"笃" |
| **level:start** | `playStartJingle()` 3 sine 上行 | **古筝散板**: triangle 523 + 659 + 784 + 1047 各 150ms 加 12kHz LP filter + reverb-ish delay 50ms | 听感:"叮-咚-哒-铃" |
| **level:complete** | `win()` 3 sine 升序 | **凯旋鼓 + 风铃**: <br>1. 锣 (LP noise + 800Hz sine 400ms 衰减) <br>2. 风铃 1320+1760+2093Hz <br>3. 鼓点 (kick 60Hz sine 200ms) | 听感:"锵-铃-咚" |
| **level:fail** | `lose()` 3 sine 降序 | **落幕**: triangle 392 + 311 + 247 各 400ms + 加 LP noise 像远雷 | 听感:"呜——" |
| **achievement:unlocked** | `unlock()` 4 sine 上行 | **古筝花指**: triangle 523→659→784→1047→1318Hz 各 200ms + 8kHz LP filter + 30ms 延迟 | 听感:"叮铃铃铃" |
| **game:pause** | `playPause()` triangle 330Hz | **钟声**: sine 660Hz 200ms 长衰减 (像寺庙钟) | 听感:"铛~" |
| **game:resume** | `playResume()` triangle 440Hz | **快鼓点**: 短 sine 440 + 660 + 880 各 50ms (紧凑) | 听感:"哒哒哒" |
| **low-life warning** (新增) | 无 | **心跳**: sine 60Hz 短脉冲每 1.2s 重复,连击警告 | 听感:"咚...咚..." |

**实现细节**:
- 用 `AudioBuffer` 预生成 1 段 0.5s 噪声 → 所有需要 noise 的 SFX 复用
- 用 `BiquadFilterNode (lowpass/highpass/bandpass)` 给每个 SFX 加塑形
- 引入"音色随机微变": 同类 SFX 频率在 ±5% 范围随机偏移,模拟自然变化
- 引入"播放次数叠加": 同一 SFX 在 100ms 内连发时,自动降低 gain 30% 避免爆音

### 2.5 L3 Voice 层 (大幅扩展)

#### 音色重新选

| 角色 | 当前 (macOS say) | 新 (Matrix TTS) | 理由 |
|------|----------------|----------------|------|
| monkey | Eddy (中文) | **可爱男童 (`cute_boy`)** | 童声鼓励,亲切感强,符合"打怪升级小帮手"的人设 |
| mole | Flo (中文) | **萌萌女童 (`lovely_girl`)** | 高音刺耳感更适合"被打中"的尖叫声 |

> 备选:monkey 可换 `clever_boy` (聪明男童) 给"通关祝贺"用,tier 越高用的音色越成熟

#### 文案大幅扩充

| kind | 当前 5 句 | 新文案 (10+ 句) | emotion 策略 |
|------|---------|----------------|--------------|
| **monkeyHit** | 太棒啦!打中啦!真准!好厉害!再来一个! | + 连击!、完美!、手速真快!、加油加油!、3连击!、5连击!、势如破竹!、冲鸭! | happy / excited |
| **monkeyMiss** | 再来一次!别灰心!加油加油!差一点!下次一定行! | + 别放弃!、稳住!、深呼吸!、慢慢来!、没关系的!、相信自己!、坚持就是胜利!、失败是成功之母! | sad → happy (鼓励语气) |
| **monkeyWin** | 通关啦!太厉害啦!满分!你是打字小高手!完美收官! | + 完美收官!、最佳成绩!、太牛啦!、你是打字大师!、继续保持!、下一关更精彩! | happy / triumphant |
| **monkeyLose** | 再来一局!加油!下次一定行!别灰心哦~再来一次! | + 别灰心!、坚持!、你已经很棒了!、继续加油!、再来挑战!、进步了!、下次一定通关! | sad / soft |
| **moleHit** | 哎呦呦!疼啊~~~~啊啊啊啊!哎哟喂~!救命啊! | + 哎哟!、疼疼疼!、我的头!、啊呀呀!、别打我!、放过我!、救命!、疼死啦! | fearful / surprised |
| **moleTaunt** | 打不到我!哈哈!来呀!你按错啦!略略略~ | + 哈哈打不到!、瞄~、弱!、太慢啦!、你来呀!、抓不到!、气死你!、嘿嘿! | neutral / mischievous |
| **monkeyCombo2** (新增) | - | 2连击!继续!再加把劲! | happy |
| **monkeyCombo3** (新增) | - | 3连击!太神啦!势如破竹! | excited |
| **monkeyCombo4** (新增) | - | 完美节奏!神仙手速!你太牛啦! | triumphant |
| **monkeyLowLife** (新增) | - | 小心!坚持住!加油! | worried → happy |
| **monkeyFinale** (新增,last 10s) | - | 最后10秒!冲刺!加油! | excited |

#### 情感参数策略

```ts
// 不是所有 line 都用 happy,按事件分类
moleHit       → emotion: 'fearful'/'surprised', speed: 1.2~1.3
moleTaunt     → emotion: 'neutral',          pitch: +3~+5 (调高显嘲弄)
monkeyHit     → emotion: 'happy',            speed: 1.1~1.2
monkeyMiss    → emotion: 'sad',              speed: 0.85~0.95 (慢下来显温柔)
monkeyWin     → emotion: 'happy',            speed: 1.0
monkeyLose    → emotion: 'sad',              speed: 0.8~0.9
monkeyCombo4  → emotion: 'happy',            speed: 1.3 (高潮加速)
```

#### 空间感 (可选,Phase 2)

如果浏览器支持 `PannerNode`,可以给每只 mole 的声音加左右声道位置 (基于 holeIndex)。Phase 1 先不做,Phase 2 加。

---

## 三、关键技术决策

### 3.1 噪声复用 Buffer

```ts
// 启动时一次性生成 0.5s 白噪声,所有 SFX 复用,避免反复创建
private initNoiseBuffer() {
  if (!this.ctx) return;
  const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  this.noiseBuffer = buf;
}

// 用法:play "土爆" 声
private playNoiseBurst(durationMs: number, filterFreq: number, gain: number) {
  const src = this.ctx.createBufferSource();
  src.buffer = this.noiseBuffer;
  const filter = this.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const g = this.ctx.createGain();
  g.gain.setValueAtTime(gain, this.ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + durationMs/1000);
  src.connect(filter).connect(g).connect(this.sfxGain);
  src.start();
}
```

### 3.2 自动 Ducking

```ts
// SFX/voice 触发时,BGM 暂时压低
private duckBgm(durationMs = 200) {
  if (!this.ctx || !this.bgmGain) return;
  const g = this.bgmGain.gain;
  g.cancelScheduledValues(this.ctx.currentTime);
  g.setValueAtTime(g.value, this.ctx.currentTime);
  g.linearRampToValueAtTime(0.04, this.ctx.currentTime + 0.05);   // 压到 0.04
  g.linearRampToValueAtTime(0.10, this.ctx.currentTime + durationMs/1000 + 0.2); // 200ms 恢复
}
```

### 3.3 音色随机微变

```ts
// 避免每次都完全一样
private vary(baseFreq: number, range = 0.05) {
  return baseFreq * (1 + (Math.random() - 0.5) * range * 2);
}
```

### 3.4 BGM 通道化

```ts
interface BgmTrack {
  name: 'melody' | 'bass' | 'pad' | 'tick';
  notes: { freq: number; startStep: number; durMs: number }[];
  baseGain: number;
  enabledByTier: number;  // 从哪个 combo tier 起启用
}

const bgmThemeA: BgmTrack[] = [
  { name: 'pad', notes: [...低频长音...], baseGain: 0.05, enabledByTier: 1 },
  { name: 'melody', notes: [...五声音阶主旋律...], baseGain: 0.10, enabledByTier: 1 },
  { name: 'bass', notes: [...bass 4 步一音...], baseGain: 0.08, enabledByTier: 2 },
  { name: 'tick', notes: [...木鱼节拍...], baseGain: 0.06, enabledByTier: 3 },
];
```

### 3.5 Voice 引擎扩展

```ts
// voiceLines.ts 新结构
export interface VoiceLine {
  text: string;
  voice: 'cute_boy' | 'lovely_girl' | 'clever_boy';
  emotion: 'happy' | 'sad' | 'neutral' | 'fearful' | 'surprised';
  speed?: number;
  pitch?: number;
}

export const VOICE_LINES: Record<VoiceLineKind, VoiceLine[]> = {
  monkeyHit: [
    { text: '太棒啦', voice: 'cute_boy', emotion: 'happy', speed: 1.15 },
    { text: '打中啦', voice: 'cute_boy', emotion: 'happy', speed: 1.2 },
    ...
  ],
  ...
};
```

### 3.6 事件扩展

在 `src/types/game.ts` 的 GameEvent 加几个新事件:

```ts
| { type: 'combo:milestone'; tier: 1|2|3|4; combo: number }  // 触发 monkeyCombo2/3/4
| { type: 'life:warning'; lives: number }                      // 触发 low-life 心跳
| { type: 'level:finale'; remainingMs: number }                // 触发最后冲刺台词
```

`audioDirector` 监听新事件并路由。

---

## 四、Settings UI 调整

`src/pages/settings.ts` 加 1 个新开关:**环境音 (ambient)**。其他保持。

> 也可考虑加 SFX / BGM / Voice 的独立音量滑块 (3 个),而不只是总音量。
> 但 Phase 1 先只加 ambient 开关,Phase 2 再做独立音量。

---

## 五、Demo 样片 (先听新方向)

按新设计用 Matrix TTS + Music 生成的几段对比样片:

| 类型 | 描述 | 来源 |
|------|------|------|
| monkey cheer (新) | 可爱男童 · 童趣鼓励 | Matrix TTS `cute_boy` + emotion happy |
| mole pain (新) | 萌萌女童 · 害怕尖声 | Matrix TTS `lovely_girl` + emotion fearful |
| mole taunt (新) | 萌萌女童 · 调高嘲弄 | Matrix TTS `lovely_girl` + pitch +4 |
| BGM 主题A · 竹林清晨 | 五声音阶古筝 + 竹笛 pad | AI 作曲 |
| BGM 主题B · 锣鼓欢腾 | 五声音阶快节奏 + 打击乐 | AI 作曲 |
| L0 ambient · 竹林 | 风声 + 鸟鸣 + 沙沙 | AI 作曲 |

> 听感对比现在的 `square` 单线,差距是数量级的。

---

## 六、实施 Roadmap (Phase 1 → Phase 2)

### Phase 1: 核心重写 (2~3 个 session)

1. **重构 `audioEngine.ts`**
   - 4 层 GainNode 总线架构
   - noiseBuffer 预生成
   - 所有现有 SFX 替换为新设计
   - 加 ducking
   - 加音色随机微变
   - 加 low-life 心跳

2. **重写 BGM**
   - 4 通道 (melody/bass/pad/tick) 架构
   - 主题 A 数据
   - combo tier 通道开关联动
   - pause/resume/切换主题的渐变

3. **加 L0 ambient**
   - 竹林 noise loop
   - 与 BGM 同步开关

4. **扩展 `voiceLines.ts`**
   - 11 个 kind (含新增 5 个)
   - 10+ 句/每 kind
   - emotion/speed/pitch 字段

5. **生成新 voice pack**
   - 改写 `scripts/generate-voice-pack.mjs`,支持 Matrix TTS
   - 调用 `matrix_batch_text_to_audio` 批量生成
   - 输出到 `public/voice/`

6. **扩展事件**
   - `src/types/game.ts` 加新事件类型
   - `src/core/engine.ts` 发出新事件 (combo:milestone / life:warning / level:finale)
   - `src/audio/audioDirector.ts` 监听新事件

7. **更新 Settings UI**
   - 加 ambient 开关

8. **更新/新增测试**
   - `audioEngine.test.ts` 加 noise buffer / ducking / 4-channel 测试
   - `audioDirector.test.ts` 加新事件路由测试

### Phase 2: 锦上添花 (后续)

- 多 BGM 主题 (主题 B/C)
- 空间感 PannerNode
- SFX/BGM/Voice 独立音量滑块
- AI 生成更精细的环境音 (雨夜/雪原,根据主题切换)

---

## 七、关键文件清单

| 文件 | 改动类型 |
|------|---------|
| `src/audio/audioEngine.ts` | 大改 (320 行 → ~600 行) |
| `src/audio/audioDirector.ts` | 加新事件路由 |
| `src/audio/speechEngine.ts` | 加 emotion/pitch 字段支持 |
| `src/speech/voiceLines.ts` | 重写 |
| `src/core/engine.ts` | 发新事件 |
| `src/types/game.ts` | 加新事件类型 |
| `src/store/slices/settings.ts` | 加 `ambientEnabled` 字段 |
| `src/pages/settings.ts` | 加 UI 开关 |
| `scripts/generate-voice-pack.mjs` | 重写 (Matrix TTS) |
| `public/voice/**` | 重新生成 |
| `src/audio/audioEngine.test.ts` | 扩展 |
| `src/audio/audioDirector.test.ts` | 扩展 |