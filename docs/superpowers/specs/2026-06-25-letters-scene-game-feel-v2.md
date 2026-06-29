# 云猴打字 v2 — Letters 场景 Game Feel 重塑

**日期**: 2026-06-25
**版本**: v2.0 (基于 v1.0 letters 实现)
**状态**: 待用户审核
**目标**: 让 5-7 岁孩子玩英文字母场景"爱不释手"

## 一、动机与目标

### 1.1 为什么做 v2

v1 已经把"英文字母场景"打通了:场景接口、地鼠生成、关卡数据、计分、成就、HUD、虚拟键盘、印章字符都已实现并跑通 39 个测试。

但根据对 v1 的体验走查,它在 **moment-to-moment 体验** 上存在三个关键短板:

1. **击中反馈单一** — 印章盖下 + 220Hz beep + 猴子挥槌,对一个 5-7 岁孩子来说,**按下去的那一刻** 不够"爽"
2. **漏掉体验负面** — 地鼠直接下沉,孩子除了"哦"之外没有反应窗口,容易沮丧
3. **没有"为什么继续玩"的钩子** — 分数在涨但缺乏升级感,缺乏目标

如果 letters 场景孩子不爱玩,后续拼音/单词/成语场景搭建得再好也无法被触发。**这一版的核心目标是: 孩子按下第一个键的瞬间就想按下一个键。**

### 1.2 目标用户

- **年龄**: 5-7 岁 (学龄前后,刚认识字母)
- **场景**: 桌面 + 家长陪同
- **频次**: 每天多局,单局 60 秒,可能中途退出
- **认知负荷**: 不能依赖长篇文字提示;视觉/听觉是主要反馈通道

### 1.3 范围边界

**做**:
- Combo 分级反馈 (4 档)
- 击中反馈增强 (粒子 + 印章盖下 + 浮动 +分)
- **漏掉 = 地鼠嘲讽** (核心新机制)
- 失败柔性化 (lives 增加,combo 保护,柔性文案)
- 猴子动态 (5 态)
- 3 星评级
- HUD combo 升级视觉

**不做** (本次降级):
- 退出续关 (gamestore 不持久化)
- 26 个地鼠角色收集
- 猴子 XP / 等级 / 装扮
- 拼音/单词/成语场景

**YAGNI 记录**: 退出续关被降级,因为数据模型改动会动到 store 中间件,与本次"爽感"目标关联弱,且会显著扩大改动面。后续版本再考虑。

## 二、整体设计

### 2.1 核心循环重塑

```
v1: 按键 → 击中(印章+beep+挥槌) → 下一只
v2: 按键 → 击中
        ├─ 粒子爆发 (1-28 颗随 tier)
        ├─ 印章盖下动画 (cubic-bezier 印章感)
        ├─ 浮动 +分 (从命中点升起)
        ├─ HUD combo 升级动画 (tier 1→2→3→4)
        ├─ 屏幕反馈 (tier 3+: 微震 / 光晕)
        └─ 猴子状态切换 (idle → hit → idle)
      → 错过超时 → 地鼠嘲讽 (400ms)
                       ├─ 眯眼 + 吐舌 + 身体倾 8°
                       ├─ 头顶气泡 (随机 5 词)
                       └─ 下滑音 (440→220Hz, 0.15s)
                    → 才 retreat + 扣命
      → 通关 → 3 星评级 (按表现)
```

### 2.2 Combo 4 档分级

| Tier | Combo 区间 | 加成 | 视觉 | 听觉 | 反馈 |
|------|-----------|------|------|------|------|
| 1 | 1-4 | ×1.0 | 4-6 颗墨点 | 220Hz + 0.06s 延音 | HUD 数字 +1 弹一下 |
| 2 | 5-9 | ×1.2 | 12 颗带尾巴墨点 | 330Hz + 440Hz 和声 | 屏幕暖色叠加 8% |
| 3 | 10-19 | ×1.5 | 18 颗墨点 + 屏幕微震 4px (0.15s) | 440Hz + 660Hz 双音 + 短回响 | 蜜金 15% + 边缘 vignette + HUD 描边朱砂 |
| 4 | 20+ | ×2.0 | 28 颗墨点 + 屏幕震 6px + 纸纹滚动 4px | 440+660+880Hz + 胜利短号 | 朱砂+蜜金光晕脉冲 + "连击x20!"飞字 + ⭐累加 |

**升级瞬间**: 880Hz 短音 0.1s (独立于 hit 音),所有视觉反馈同步触发。

### 2.3 漏掉 = 地鼠嘲讽(核心新机制)

**v1 流程**:
```
hit window 结束 → mole.retreating (150ms) → mole.hidden → emit mole:miss
```

**v2 流程**:
```
hit window 结束 (T=0)
  ↓
mole.state = 'taunting' (持续 400ms)
  - 身体倾斜 8°
  - 眯眼 + 吐舌 + 腮红
  - 头顶出现对话气泡 (DOM 浮层)
  - 下滑音 440Hz → 220Hz (0.15s)
  ↓
T=400ms: mole 进入 'retreating' (沿用 v1 150ms 收回动画)
  ↓
mole.hidden → 才 emit 'mole:miss' → 扣命 + combo 规则判定
```

**为什么先嘲讽再扣命**:
- 给玩家 400ms 反应窗口,降低挫败感
- 让"漏掉"成为记忆点(有角色、有动作、有声音)
- 嘲讽期间游戏正常进行,玩家可继续按键打其他地鼠

**文案池** (5 词随机,刻意避开负面词):
```
"嘿嘿~" · "瞄~" · "差一点~" · "再来呀~" · "哎?没中~"
```
- "瞄~" 借鉴猫咪叫声,接受度高
- 5 词中至少 1 个会让孩子笑
- 用 `font-family: 'ZCOOL KuaiLe', cursive;`(项目已有的手写体)

### 2.4 Combo 保护规则

```
if (combo >= 5 && newMissCount === 1) {
  // combo ≥ 5 时漏 1 只不归零,只 -1 combo
  newCombo = Math.max(0, currentCombo - 1)
} else {
  // 其他情况归 0
  newCombo = 0
}
```
- combo ≥ 10 时漏 1 只 → combo 变成 9(孩子有"差点保住"的感觉)
- combo < 5 时漏掉 → 直接归 0(让新手有"连击中断"的清晰信号)
- 连续漏 2 只以上 → 必归 0(不能让 combo 永远挂在那)

### 2.5 失败柔性化

| 维度 | v1 | v2 |
|------|----|----|
| Lives 默认 | 5 | **8** |
| Lives 上限 | 5 | **10** (每次升到 combo ≥ 20 时 lives += 1,直到上限 10) |
| 失败 modal 标题 | "💔 失败" | "继续加油!" |
| 失败 modal 内容 | "原因: xxx" | 鼓励文案 + 猴子捂脸 emoji "🙈" |
| 失败 modal 按钮 | 重玩 / 回主页 | 再试一次 / 回主页 / 看怎么玩 |
| 通关条件 | 满足 winCondition | 满足 winCondition + 评级 |

### 2.6 3 星评级

| 星数 | 条件 |
|------|------|
| ⭐⭐⭐ (3 星) | hits ≥ target **且** misses === 0 **且** maxCombo ≥ 20 |
| ⭐⭐ (2 星) | hits ≥ target **且** maxCombo ≥ 10 |
| ⭐ (1 星) | 通关 (满足 winCondition) |

显示位置:
- 通关 modal 顶部 (3 颗星星,未达成空心 + 朱砂色)
- 失败时不显示评级

### 2.7 猴子 5 态

| 状态 | 触发 | 表现 |
|------|------|------|
| `idle` | 默认 | 缓呼吸 (身体 1.0→1.03→1.0, 周期 2.5s) |
| `hit` | 击中 | 槌画弧 + 身体压低 30% 然后弹回 (0.3s) |
| `combo` | combo ≥ 10 | 跳跃 8px + 360° 转槌 (0.6s) |
| `taunt` | 地鼠嘲讽中 | 双手捂嘴 + 惊讶脸 + 身体晃 (持续到 taunt 结束) |
| `miss` | miss 结算后 | 垂肩 + 叹气表情 (0.5s) 然后回 idle |

`drawMonkey(ctx, x, y, state)` 接收状态参数,内部根据状态切换绘制分支。新增 `src/render/monkeyAnimations.ts` 管理状态时间和过渡。

## 三、数据模型

### 3.1 GameState 增量字段

```typescript
interface GameState {
  // ... 已有字段保持不变

  // 新增
  comboTier: 1 | 2 | 3 | 4;
  comboStarCount: number;          // Tier 4 阶段每 hit +1,满 10 通关加分
  lastTierUpgradeAt: number;      // 用于控制升级"叮!"声不重复
  lastTier: 1 | 2 | 3 | 4;         // 用于 detect tier 变化
  currentTaunt: { moleId: string; text: string; x: number; y: number; startedAt: number } | null;
  starsEarned: 0 | 1 | 2 | 3;      // 通关时计算
}
```

### 3.2 Mole 新增状态

```typescript
type MoleState = 'hidden' | 'rising' | 'active' | 'retreating' | 'hit' | 'taunting';
```

- `taunting` 是新状态,持续 400ms 后自动转 `retreating`
- `advanceMole(m, stayTime, now)` 需要识别 taunting 的超时

### 3.3 EventBus 新增事件

```typescript
type GameEvent =
  | { type: 'mole:spawn'; mole: Mole }
  | { type: 'mole:hit'; mole: Mole; responseMs: number }
  | { type: 'mole:miss'; holeIndex: number }
  | { type: 'mole:timeout'; mole: Mole }
  | { type: 'mole:taunt'; mole: Mole; text: string }    // 新增
  | { type: 'combo:tier-up'; tier: 1 | 2 | 3 | 4 }       // 新增
  | { type: 'combo:reset'; from: number }                // 新增
  | { type: 'hit:visual'; mole: Mole; score: number }   // 新增 (与 hit 分离避免循环)
  | { type: 'level:start'; levelId: number }
  | { type: 'level:complete'; stats: LevelStats }
  | { type: 'level:fail'; reason: FailReason }
  | { type: 'achievement:unlocked'; id: string }
  | { type: 'key:press'; key: string }
  | { type: 'game:pause' }
  | { type: 'game:resume' };
```

### 3.4 新增工具函数

```typescript
// src/core/scoring.ts
export function comboTier(combo: number): 1 | 2 | 3 | 4 {
  if (combo >= 20) return 4;
  if (combo >= 10) return 3;
  if (combo >= 5)  return 2;
  return 1;
}

export function scoreMultiplier(tier: 1|2|3|4): number {
  return [1.0, 1.2, 1.5, 2.0][tier - 1];
}

// src/core/missRule.ts (新文件)
export function nextComboAfterMiss(currentCombo: number, missCount: number): number {
  if (currentCombo >= 5 && missCount === 1) {
    return Math.max(0, currentCombo - 1);
  }
  return 0;
}

// src/core/rating.ts (新文件)
export type StarRating = 0 | 1 | 2 | 3;
export function calcStars(stats: { misses: number; maxCombo: number }, win: { hits: number; target: number }): StarRating {
  if (win.hits < win.target) return 0;
  if (stats.misses === 0 && stats.maxCombo >= 20) return 3;
  if (stats.maxCombo >= 10) return 2;
  return 1;
}
```

## 四、模块边界与文件改动

### 4.1 改动清单

```
src/
├── core/
│   ├── scoring.ts                 改 — 加 comboTier, scoreMultiplier
│   ├── missRule.ts                新 — 抽离 combo 保护规则
│   ├── rating.ts                  新 — 3 星评级
│   ├── mole.ts                    改 — 加 taunting state 分支
│   ├── engine.ts                  改 — tier-up 事件, taunting 流程, miss 结算延后
│   └── eventBus.ts                改 — 加新事件类型
│
├── render/
│   ├── effects.ts                 新 — ParticleSystem
│   ├── renderer.ts                改 — 订阅 tier-up / mole:taunt, tick 粒子
│   ├── sprites/mole.ts            改 — drawMole 加 mode: 'normal' | 'taunt'
│   ├── sprites/monkey.ts          改 — drawMonkey 加 state 参数
│   └── monkeyAnimations.ts        新 — 状态时间管理
│
├── ui/
│   ├── hud.ts                     改 — combo 数字加 tier 样式 + 升级动画
│   └── resultModal.ts             新 — 抽离 modal,支持评级
│
├── audio/
│   └── audioEngine.ts             改 — 加 tier 升级音, taunt 音, 多级 hit 音
│
├── pages/
│   └── game.ts                    改 — taunt 气泡 DOM, 评级 modal, 柔性文案
│
└── styles/
    └── (已有 animations.css)      改 — 加 .taunt-bubble, .combo-tier-3, .star-rating

data/
└── levels/letters-level-{1,2,3}.json  改 — lives 5 → 8
```

### 4.2 不动的边界

- `src/scenes/types.ts` — Scene 接口不变 (taunt 文案池放在 letters.ts 内部)
- `src/scenes/letters.ts` — 内部加 `getTauntTexts()` 导出,不影响 Scene 接口
- `src/scenes/types.ts` 的 `renderKey()` 不变 (印章样式已固定)
- `src/store/middleware/persistence.ts` — **不动**(本次不做退出续关)
- `src/store/slices/settings.ts` — 不动
- `src/achievements/*` — 不动(成就规则不变,但通关条件硬指标可能变化)

### 4.3 关注点分离

| 关注点 | 归属 | 不应进入 |
|--------|------|----------|
| Tier 计算 | `core/scoring.ts` | render / ui |
| Combo 保护规则 | `core/missRule.ts` | engine (engine 只调用) |
| 评级 | `core/rating.ts` | ui |
| 粒子生成 | `render/effects.ts` | core |
| 猴子动画状态 | `render/monkeyAnimations.ts` | core / sprites |
| 嘲讽文案池 | `scenes/letters.ts` | core |
| 气泡 DOM | `pages/game.ts` | render |
| 浮动 +分 | `render/effects.ts` | ui |
| tier 升级音 | `audio/audioEngine.ts` | engine |

## 五、组件设计

### 5.1 ParticleSystem

```typescript
// src/render/effects.ts
export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number; color: string;
}

export class ParticleSystem {
  particles: Particle[] = [];
  floatingTexts: FloatingText[] = [];

  burst(x: number, y: number, tier: 1|2|3|4, color: string): void
  floatText(text: string, x: number, y: number, color: string): void
  tick(dt: number): void
  draw(ctx: CanvasRenderingContext2D): void
  clear(): void
}
```

订阅:
- `bus.on('hit:visual', e => burst(...))` — 命中粒子
- `bus.on('mole:taunt', e => floatText('嘿嘿~', ...))` — 嘲讽气泡 (但实际用 DOM)

### 5.2 TauntBubble (DOM 浮层)

```typescript
// src/ui/tauntBubble.ts
export class TauntBubble {
  mount(root: HTMLElement): void
  show(text: string, x: number, y: number, durationMs: number): void
  destroy(): void
}
```

挂在 canvas-mount 上,绝对定位跟随 hole 位置。

### 5.3 MonkeyAnimations

```typescript
// src/render/monkeyAnimations.ts
export type MonkeyState = 'idle' | 'hit' | 'combo' | 'taunt' | 'miss';

export class MonkeyAnimations {
  private state: MonkeyState = 'idle';
  private stateStartedAt: number = performance.now();
  private comboTauntUntil: number = 0;
  
  setState(state: MonkeyState): void
  extendTaunt(until: number): void   // 地鼠嘲讽期间持续
  getCurrentState(): MonkeyState
  getStateAge(): number              // 用于 sprite 内的 lerp
}
```

订阅:
- `bus.on('hit:visual', ...)` → setState('hit')
- `bus.on('combo:tier-up', e => e.tier >= 3 && setState('combo'))`
- `bus.on('mole:taunt', e => extendTaunt(e.mole.appearAt + 400))`
- `bus.on('mole:miss', ...)` → setState('miss')

### 5.4 HUD combo 升级样式

```css
.hud-combo { transition: transform 0.2s; }
.hud-combo--tier-2 { color: var(--honey); }
.hud-combo--tier-3 {
  color: var(--vermilion);
  box-shadow: 0 0 0 3px var(--vermilion);
  border-radius: 8px;
}
.hud-combo--tier-4 {
  background: linear-gradient(135deg, var(--vermilion), var(--honey));
  color: var(--paper);
  animation: combo-pulse 0.8s ease-in-out infinite alternate;
}
@keyframes combo-pulse {
  from { transform: scale(1); }
  to   { transform: scale(1.08); }
}
.hud-combo--bump { animation: combo-bump 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes combo-bump {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.4); }
  100% { transform: scale(1); }
}
```

## 六、错误处理与边界

### 6.1 边界情况

| 情况 | 处理 |
|------|------|
| 多个地鼠同时嘲讽 | 气泡分别定位,各画各的,不上限(但 ≥3 时只显示最近一个) |
| tier 升级和 hit 同时发生 | tier 升级事件先发,粒子和音分两帧播放 |
| 嘲讽期间关卡结束 | 立即清除气泡,直接进入结算 |
| 嘲讽期间暂停 | 气泡保留,resume 后继续计时(已超 400ms 则直接 retreat) |
| 嘲讽文案被随机到"嘿嘿~"在朝向下不对 | 气泡自带 `transform: rotate(-5deg)` 让它"歪着说" |
| lives 加到上限 10 后 combo ≥ 20 | 不再加,显示"❤已满" |
| 通关时 combo 还在升级中 | 完成升级后再展示评级 modal |

### 6.2 性能边界

- 粒子最多 60 颗同时存在(tier 4 单次 28 + 累积),`tick` 自动清理
- DOM 气泡最多 3 个同时显示
- HUD combo 升级动画用 CSS,不触发 JS 计算

## 七、测试策略

### 7.1 单元测试 (Vitest)

| 测试 | 覆盖 |
|------|------|
| `comboTier()` 边界 | 输入 0,1,4,5,9,10,19,20,21,100 → 输出对应 tier |
| `scoreMultiplier()` | 4 个 tier 输出 1.0/1.2/1.5/2.0 |
| `nextComboAfterMiss()` | combo=10,miss=1 → 9; combo=10,miss=2 → 0; combo=4,miss=1 → 0 |
| `calcStars()` | 3 星:miss=0 + combo≥20 + 达标;2 星:combo≥10 + 达标;1 星:达标;0:不达标 |
| `advanceMole()` taunting | rising→active→taunting→retreating→hidden 时序正确 |
| Particle 清理 | tick 100ms 后过期粒子被移除 |

### 7.2 集成测试

| 测试 | 覆盖 |
|------|------|
| `engine.handleKey()` 触发 tier-up | combo 0→5 时 `combo:tier-up` 事件被 emit 一次 |
| `engine.handleKey()` 触发 hit:visual | 每次 hit emit `hit:visual` 含 score |
| `engine.tick()` taunting 流程 | mole.timeout 后 400ms 才 emit `mole:miss` |
| `engine.tick()` combo 保护 | combo=5 时漏 1 只,combo 变 4 而非 0 |
| `engine.fail()` lives 8 默认 | lives 默认 8 而非 5(`level.loseCondition.max` 由 JSON 提供) |

### 7.3 视觉/手动测试

- 通关评级页截图对比
- HUD combo 升级动画肉眼检查
- 嘲讽气泡位置准确 (随 hole)
- 4 tier 粒子密度肉眼感受

### 7.4 数量目标

- v1: 39 个测试
- v2 目标: 39 + 10 ~ 12 = **~50 个测试**

## 八、开发顺序

按依赖关系,推荐 5 阶段(每阶段独立可测):

1. **Stage 1: 数据层**
   - `scoring.ts` 加 `comboTier`, `scoreMultiplier`
   - `missRule.ts` 新建
   - `rating.ts` 新建
   - `eventBus.ts` 加新事件类型
   - 单元测试

2. **Stage 2: 引擎层**
   - `engine.ts` tier-up 事件 + combo 保护 + miss 延后
   - `mole.ts` taunting state 分支
   - 集成测试

3. **Stage 3: 渲染层**
   - `effects.ts` ParticleSystem
   - `sprites/mole.ts` taunt 模式
   - `sprites/monkey.ts` 5 态
   - `monkeyAnimations.ts` 状态管理
   - 单元测试 + 手动截图

4. **Stage 4: UI/音频层**
   - `hud.ts` combo tier 样式
   - `tauntBubble.ts` DOM 浮层
   - `audioEngine.ts` 新增 4 个音
   - `resultModal.ts` 评级页
   - 集成测试

5. **Stage 5: 整合**
   - `pages/game.ts` 串起来
   - `data/levels/*.json` lives 5→8
   - 全量测试通过

## 九、风险与权衡

| 风险 | 影响 | 缓解 |
|------|------|------|
| 嘲讽气泡在某些屏幕分辨率下错位 | 中等 | 用 CSS `transform: translate(-50%, -100%)` 跟随 hole,加 resize 重算 |
| 屏幕震动在低端设备掉帧 | 低 | 震动只在 tier 3+ 触发,持续 ≤ 0.15s,且用 CSS transform 不触发 layout |
| 浮动 +分 文本看不清 | 中等 | 用 `ZCOOL KuaiLe` 手写体 + 朱砂色 + 黑色描边 2px |
| 评级阈值与年龄不匹配 | 中等 | 默认阈值可在 settings 加"难度"开关 (后续版本) |
| 4 档 tier 升级太快或太慢 | 中等 | 阈值 5/10/20 经过内部分析,5 岁孩子 avg hit 间隔约 1.5s, 5 次约 7-8s 第一次升级,合适 |
| 改动 `engine.ts` 引入回归 | 高 | 集成测试覆盖原 39 个用例 + 新 10-12 个,必须全过 |
| 退出续关不做但用户期望 | 中等 | 已确认降级,后续版本补 |

## 十、YAGNI 决策记录

| 项 | 决策 | 原因 |
|----|------|------|
| 退出续关 | 不做 | 数据模型改动大,与爽感目标弱关联 |
| 26 地鼠角色 | 不做 | 美术工作量,与爽感目标弱关联 |
| 猴子 XP/装扮 | 不做 | 系统性扩展,延后 |
| 拼音/单词/成语场景 | 不做 | 本次专注 letters |
| BGM | 不做 | v1 也没有,本次不加 |
| 关卡编辑器 | 不做 | spec 列了"非目标" |
| 移动端虚拟键盘 | 不做 | 桌面 + 家长陪同场景明确 |
| 多人对战 | 不做 | spec 列了"非目标" |

## 十一、关键文件路径速查

| 关注点 | 路径 |
|--------|------|
| 数据层规则 | `src/core/{scoring,missRule,rating}.ts` |
| 引擎改造 | `src/core/{engine,mole,eventBus}.ts` |
| 粒子系统 | `src/render/effects.ts` |
| 猴子状态 | `src/render/{monkeyAnimations,sprites/monkey}.ts` |
| 地鼠嘲讽 | `src/render/sprites/mole.ts` + `src/ui/tauntBubble.ts` |
| HUD combo 样式 | `src/ui/hud.ts` + `src/styles/animations.css` |
| 音效 | `src/audio/audioEngine.ts` |
| 整合 | `src/pages/game.ts` |
| 关卡 lives | `data/levels/letters-level-{1,2,3}.json` |
