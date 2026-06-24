# 云猴打字 (Yunhou Typing Game) - 设计文档

**日期**: 2026-06-24
**版本**: v1.0
**状态**: 待用户审核

## 一、项目概述

### 1.1 目标

开发一个网页版的打字练习游戏 "云猴打字":画面中有一只可爱的小猴子 (yunhou),地上有多个地洞,地鼠从洞里钻出来,身上背着键盘上的字符 (字母、数字、符号等),玩家正确按出对应按键即可打中地鼠。游戏通过地鼠停留时间和字符复杂度调节难度,有计时、速度统计、成功数量计分,并配套成就体系。屏幕下方展示与物理键盘对应的虚拟键盘,强化玩家对键盘按键位置的体感。

### 1.2 设计原则

- **本地优先,云端同步**: 操作零延迟,跨设备进度同步
- **场景可横向扩展**: 数据驱动,加新场景不改代码
- **模块边界清晰**: 引擎对场景无知,UI 不直接调 Service
- **可视化优先**: 卡通风格,弹性动画,沉浸反馈

### 1.3 非目标 (第一版)

- 多人在线对战
- 自定义关卡编辑器
- 移动端虚拟键盘 (仅桌面浏览器)
- 服务端关卡内容运营

## 二、整体架构

### 2.1 系统分层

```
┌──────────────────────────────────────────────────────────────┐
│  Presentation Layer (UI)                                     │
│  - DOM 菜单/设置/成就页                                       │
│  - Canvas 游戏画布 + HUD (分数/计时)                          │
└─────────────────────┬────────────────────────────────────────┘
                      │ events (input) / reads (state)
┌─────────────────────▼────────────────────────────────────────┐
│  Application Layer (Game Logic)                              │
│  - Game Engine: 游戏循环、状态机                              │
│  - Level Manager: 关卡配置                                    │
│  - Scoring: 计分、连击                                        │
│  - Achievement Engine: 成就规则                                │
│  - Input Controller: 键盘事件分发                              │
└─────────────────────┬────────────────────────────────────────┘
                      │ mutations / subscriptions
┌─────────────────────▼────────────────────────────────────────┐
│  State Layer (Store)                                         │
│  - userSlice      ←── AccountClient                          │
│  - gameSlice                                              │
│  - settingsSlice                                          │
│  - achievementsSlice                                       │
│  + middleware: persistence (localStorage) + sync (cloud)     │
└─────────────────────┬────────────────────────────────────────┘
                      │ API calls (debounced)
┌─────────────────────▼────────────────────────────────────────┐
│  Service Layer                                               │
│  - AccountClient (interface, 本地 mock 实现)                   │
│  - SyncEngine: 防抖同步、冲突解决                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 数据流 (一个按键的完整链路)

```
1. 用户按 'A' 键
   ↓
2. window keydown 事件 → InputController.handleKey('A')
   ↓
3. InputController 找到当前激活的 Mole (身上背着 'A')
   ↓
4. Game Engine 标记 Mole 为 hit,触发 hit 事件
   ↓
5. Scoring.onHit() → 计算得分 → gameSlice.set({ score, combo })
   ↓
6. AchievementEngine.check('hit_count', count) → 解锁新成就
   ↓
7. store 通知所有订阅者 → UI 重渲染 (分数+1、地鼠下沉消失、动画)
   ↓
8. AudioEngine.play('hit')
   ↓
9. (后台) syncMiddleware 防抖 2 秒后 → AccountClient.saveProgress()
```

**延迟目标**: 按键到视觉反馈 < 16ms (1 帧)。

### 2.3 路由结构

```
#/                → Home (场景选择 + 关卡列表 + 设置入口)
#/game?level=N    → Game (Canvas + HUD)
#/profile         → Profile (预留,接账户系统后展示用户数据)
#/achievements    → Achievements (成就墙)
#/settings        → Settings (音量、主题、键位、难度)
```

## 三、技术栈

| 维度 | 选型 | 理由 |
|------|------|------|
| 构建 | Vite 5 | 启动快、模块化、配置简单 |
| 语言 | TypeScript 5 | 类型安全、IDE 支持、重构友好 |
| UI 框架 | 无 (原生 JS) | Canvas 游戏无需虚拟 DOM,菜单组件自写足够 |
| 渲染 | Canvas 2D (游戏) + DOM (菜单/HUD) | 游戏性能 + 菜单开发效率兼顾 |
| 状态 | 自研 Store (pub/sub + middleware) | 零依赖,扩展性足够 |
| 路由 | 自研 hash router | 路由表简单,避免框架依赖 |
| 音效 | Web Audio API | 按需加载,响应首次交互 |
| 持久化 | localStorage + 云端同步 | 本地优先,跨设备 |
| 测试 | Vitest (单元) + Playwright (端到端) | 现代、配置简洁 |

### 3.1 存储策略:本地优先 + 云同步

| Slice | 存储位置 | 同步时机 |
|-------|---------|---------|
| user | 本地 + 云端 | 登录时拉取 |
| game (会话) | 仅本地 | 局内使用 |
| settings | 本地 + 云端 | 变更防抖同步 |
| achievements | 本地 + 云端 | 解锁时即时同步 |
| 累计统计 (hit 数等) | 本地 + 云端 | 变更防抖同步 |

**冲突解决**: "最后写入获胜" (LWW) + 时间戳。登录时拉取云端,与本地合并后用更新的覆盖。

## 四、目录结构

```
yunhou-dazi/
├── index.html                    # 入口 HTML,挂载 #app
├── vite.config.ts                # 构建配置
├── tsconfig.json
├── package.json
├── public/
│   ├── favicon.svg
│   └── manifest.webmanifest      # PWA 清单 (可选)
├── src/
│   ├── main.ts                   # 应用启动入口
│   ├── App.ts                    # 根组件,挂载路由
│   │
│   ├── core/                     # 游戏核心
│   │   ├── engine.ts             # 游戏循环、状态机
│   │   ├── level.ts              # 关卡加载与运行
│   │   ├── mole.ts               # 地鼠实体
│   │   ├── spawner.ts            # 地鼠调度器
│   │   ├── scoring.ts            # 计分、连击、反应时间
│   │   ├── inputController.ts    # 键盘事件分发
│   │   └── eventBus.ts           # 内部事件总线
│   │
│   ├── scenes/                   # 场景层 (横向扩展)
│   │   ├── types.ts              # Scene 接口
│   │   ├── letters.ts            # 英文字母场景 (第一版)
│   │   ├── pinyin.ts             # 拼音场景 (预留)
│   │   ├── words.ts              # 英文单词场景 (预留)
│   │   └── idioms.ts             # 成语场景 (预留)
│   │
│   ├── modes/                    # 游戏模式 (玩法维度扩展)
│   │   ├── classic.ts            # 经典:打地鼠
│   │   ├── words.ts              # 单词模式 (预留)
│   │   └── sentences.ts          # 句子模式 (预留)
│   │
│   ├── ui/                       # UI 组件
│   │   ├── hud.ts                # 顶部 HUD
│   │   ├── menu.ts               # 菜单
│   │   ├── settings.ts           # 设置面板
│   │   ├── achievements.ts       # 成就墙
│   │   ├── modal.ts              # 通用弹窗
│   │   └── components/
│   │       ├── button.ts         # 通用按钮
│   │       ├── icon.ts           # 图标
│   │       └── progressBar.ts    # 进度条
│   │
│   ├── input/                    # 输入处理
│   │   ├── keyboard.ts           # 物理键盘监听
│   │   └── virtualKeyboard.ts    # 虚拟键盘 (双向同步)
│   │
│   ├── render/                   # 渲染层
│   │   ├── canvas.ts             # Canvas 初始化
│   │   ├── renderer.ts           # 主渲染循环
│   │   ├── sprites/              # SVG 资源
│   │   │   ├── monkey.ts
│   │   │   ├── mole.ts
│   │   │   └── background.ts
│   │   └── effects.ts            # 粒子、特效
│   │
│   ├── audio/                    # 音效
│   │   ├── audioEngine.ts        # Web Audio API 封装
│   │   ├── sounds.ts             # 音效定义
│   │   └── bgm.ts                # 背景音乐
│   │
│   ├── store/                    # 状态管理
│   │   ├── createStore.ts        # Store 工厂
│   │   ├── middleware/
│   │   │   ├── persistence.ts    # localStorage 中间件
│   │   │   ├── sync.ts           # 云同步中间件
│   │   │   └── logger.ts         # dev 模式日志
│   │   ├── slices/
│   │   │   ├── user.ts           # 用户信息 (预留)
│   │   │   ├── game.ts           # 当前游戏状态
│   │   │   ├── settings.ts       # 设置
│   │   │   └── achievements.ts   # 成就
│   │   └── index.ts              # 组合所有 slice
│   │
│   ├── services/                 # 外部服务
│   │   ├── api.ts                # HTTP 客户端
│   │   ├── AccountClient.ts      # 账户系统接口 (预留 mock)
│   │   └── mockAccount.ts        # 本地 mock 实现
│   │
│   ├── achievements/             # 成就引擎
│   │   ├── engine.ts             # 成就检查器
│   │   ├── rules.ts              # 成就规则定义
│   │   └── rewards.ts            # 奖励发放
│   │
│   ├── router/                   # 路由
│   │   ├── router.ts             # 路由核心
│   │   └── routes.ts             # 路由表
│   │
│   ├── pages/                    # 页面
│   │   ├── home.ts
│   │   ├── game.ts
│   │   ├── profile.ts
│   │   ├── achievements.ts
│   │   └── settings.ts
│   │
│   ├── utils/                    # 工具
│   │   ├── id.ts                 # 唯一 ID 生成
│   │   ├── random.ts             # 随机工具
│   │   ├── time.ts               # 时间工具
│   │   └── throttle.ts           # 防抖/节流
│   │
│   ├── types/                    # 类型定义
│   │   ├── game.ts               # 游戏相关类型
│   │   ├── user.ts               # 用户类型
│   │   └── api.ts                # API 类型
│   │
│   ├── styles/                   # 样式
│   │   ├── reset.css
│   │   ├── variables.css         # CSS 变量 (主题)
│   │   ├── global.css
│   │   └── animations.css        # 动画 keyframes
│   │
│   └── assets/                   # 静态资源 (图片、字体)
│
├── data/                         # 数据驱动配置
│   ├── levels/                   # 关卡 JSON
│   │   ├── letters-level-1.json
│   │   ├── letters-level-2.json
│   │   └── ...
│   ├── scenes/                   # 场景配置
│   │   ├── letters.json
│   │   └── ...
│   ├── achievements.json         # 成就定义
│   └── keysets.json              # 字符集定义
│
└── tests/
    ├── unit/                     # Vitest 单元测试
    └── e2e/                      # Playwright 端到端 (可选)
```

## 五、游戏机制

### 5.1 核心玩法循环

```
玩家点击"开始"
     ↓
关卡加载 (data/levels/level-N.json)
     ↓
┌─► 游戏循环 tick (60fps)
│     - 调度器决定下一只地鼠何时出现
│     - 更新所有活动地鼠 (上升/停留/下沉)
│     - 检测过期地鼠 → 计 miss
│     - 检测超时 → 关卡失败条件
│     - 检测达标 → 关卡通过条件
│     - 渲染 Canvas
│
└─ 关卡结束 (成功 or 失败)
     ↓
结算页 (分数/速度/成就/下一关)
     ↓
玩家选择: 重玩 / 下一关 / 回主页
```

### 5.2 地鼠实体状态机

```
              spawn (调度器触发)
                 ↓
[hidden] ──► [rising] ──► [active] ──► [retreating] ──► [hidden]
                │              │              ↑
                │              │              │
                │              ▼              │
                │          [hit] ────────────┘
                │              │
                ▼              ▼
            (timeout)      (音效+动画)
```

| 状态 | 持续时间 | 说明 |
|------|---------|------|
| rising | 200ms | 从地洞滑出 |
| active | 关卡配置 | 停留,身上字符可读 |
| retreating | 150ms | 缩回 |
| hit | 100ms | 被击中特效 |

### 5.3 关卡设计

关卡配置 (JSON, 数据驱动):

```json
{
  "id": 3,
  "scene": "letters",
  "name": "数字初探",
  "duration": 60,
  "moles": {
    "activeCount": 3,
    "spawnInterval": [800, 1500],
    "stayTime": 2200
  },
  "sceneConfig": {
    "pool": ["0","1","2","3","4","5","6","7","8","9"]
  },
  "difficulty": 2,
  "winCondition": {
    "type": "score",
    "target": 500
  },
  "loseCondition": {
    "type": "misses",
    "max": 5
  }
}
```

### 5.4 难度曲线

| 档位 | 字符池 | 同时地鼠 | 停留时间 | 字符权重 |
|------|--------|---------|---------|---------|
| 1 | 左手字母 (a,s,d,f) | 2 | 3.0s | 均匀 |
| 2 | 全字母 | 3 | 2.5s | 均匀 |
| 3 | + 数字 | 3 | 2.2s | 字母优先 |
| 4 | + 符号 (-_+=) | 4 | 2.0s | 均匀 |
| 5 | + 全部符号 | 5 | 1.8s | 难字符加权 |
| 6+ | + 大小写混合 | 5-6 | 1.5-1.0s | 程序生成权重 |

### 5.5 计分规则

```
基础分 = 10 × 关卡难度 × 场景难度系数 (Scene.getDifficultyMultiplier)
反应奖励: ≤ 0.5s +50%, ≤ 1.0s +20%, ≤ 1.5s +5%, 否则无奖励
连击加成: combo ≥ 10 时每 hit +10% (最高 +100%)

最终得分 = 基础分 × (1 + 反应奖励 + 连击加成)
```

> 注: 关卡难度来自 `level.difficulty`(1-10),场景难度系数来自 `Scene.getDifficultyMultiplier()`(默认 1.0)。两者相乘得到最终难度系数,这样不同场景(成语 > 字母)即使在同一关卡数值也不同。

### 5.6 会话统计

- 当前分数
- 当前连击 / 最高连击
- 命中率 (hits / attempts)
- 平均反应时间
- 单次最快反应

## 六、场景层 (Scene Layer) - 横向扩展设计

### 6.1 设计动机

不同输入练习场景 (英文字母、汉语拼音、英文单词、成语) 在以下维度差异巨大:
- **生成方式**: 单字符 vs 完整词/成语
- **命中判定**: 单键即中 vs 顺序输入多个键
- **视觉表现**: 字符气泡 vs 分词显示 vs 竖排成语
- **难度系数**: 不同场景的认知负荷不同

把场景抽成独立层,使游戏引擎对场景无知,加新场景只需新建文件。

### 6.2 Scene 接口

```typescript
// src/scenes/types.ts
export interface Scene {
  id: string;                    // 'letters' | 'pinyin' | 'words' | 'idioms'
  name: string;                  // 显示名

  // 一次显示多少个字符
  // 字母 = 1, 单词 = word.length, 成语 = 4
  getKeysPerMole(): number;

  // 给地鼠生成身上的字符/单词/成语
  generateKey(ctx: SceneContext): string;

  // 在 Canvas 上如何绘制这个 key
  renderKey(
    ctx: CanvasRenderingContext2D,
    key: string,
    x: number,
    y: number
  ): void;

  // 命中判定逻辑
  // 字母: 单键即中; 成语: 需要按顺序打完 4 字
  matches(input: string[], target: string): boolean;

  // 难度系数 (影响计分)
  getDifficultyMultiplier(): number;
}

export interface SceneContext {
  level: number;
  rng: () => number;
  history: string[];          // 已生成的 key,避免重复
  sceneConfig: Record<string, unknown>;  // 场景自己的配置
}
```

### 6.3 第一版场景:`letters` (英文字母)

```typescript
// src/scenes/letters.ts
export const lettersScene: Scene = {
  id: 'letters',
  name: '英文字母',
  getKeysPerMole: () => 1,
  generateKey(ctx) {
    const pool = ctx.sceneConfig.pool as string[];
    return pool[Math.floor(ctx.rng() * pool.length)];
  },
  renderKey(ctx, key, x, y) {
    ctx.font = 'bold 28px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillText(key, x, y);
  },
  matches(input, target) {
    return input[0]?.toLowerCase() === target.toLowerCase();
  },
  getDifficultyMultiplier: () => 1.0,
};
```

### 6.4 后续场景实现示意 (架构示意, 先不实现)

**`pinyin.ts`** - 拼音场景
- `getKeysPerMole`: 1
- `generateKey`: 从 400+ 拼音中按级别选
- `renderKey`: 显示带声调符号 (nǐ hǎo)
- `matches`: 输入匹配去声调
- `getDifficultyMultiplier`: 1.2

**`idioms.ts`** - 成语场景
- `getKeysPerMole`: 4
- `generateKey`: 随机选一个四字成语
- `renderKey`: 四个字竖排或横排
- `matches`: 输入按顺序打完 4 字才算中 (具体规则待定)
- `getDifficultyMultiplier`: 1.8

**`words.ts`** - 英文单词场景
- `getKeysPerMole`: 单词长度
- `generateKey`: 从单词库按难度分级选
- `renderKey`: 单词横向居中显示
- `matches`: 按顺序输入整个单词
- `getDifficultyMultiplier`: 1.5

### 6.5 场景选择 UI

主菜单/Home 页展示场景卡片:

```
┌────────────────────────────────────┐
│            云猴打字                │
│                                    │
│      🐒  选择场景开始游戏          │
│                                    │
│   ┌──────────┐  ┌──────────┐      │
│   │ 英文字母  │  │  拼音    │      │
│   │  ✅可用   │  │  🔒待开  │      │
│   └──────────┘  └──────────┘      │
│   ┌──────────┐  ┌──────────┐      │
│   │  英文单词 │  │  成语    │      │
│   │  🔒待开  │  │  🔒待开  │      │
│   └──────────┘  └──────────┘      │
└────────────────────────────────────┘
```

## 七、成就系统

### 7.1 指标维度

- **逐次反应时间**: `hitTime - appearTime`,记在 Mole 实体上
- **会话平均**: 当前游戏局所有 hit 的平均
- **历史最佳**: 跨会话的最低平均
- **分布**: p50、p95,用于难度调优

### 7.2 成就规则 (数据驱动)

```typescript
// data/achievements.json
{
  "id": "speed-bronze",
  "name": "反应灵敏",
  "icon": "🥉",
  "description": "平均反应时间低于 2.5 秒",
  "condition": { "metric": "avgResponseTime", "op": "<", "value": 2.5 },
  "scope": "session",
  "reward": { "xp": 50 }
}
```

### 7.3 成就分类

1. **数量型**: 累计 hit 数 (10/100/1000/10000)
2. **速度型**: 平均反应时间 (🥉 < 2.5s, 🥈 < 1.5s, 🥇 < 0.8s, ⚡ 单次 < 0.3s, 💪 连续 50 次 < 1.0s)
3. **连击型**: 最高连击 (10/30/50/100)
4. **完美型**: 单关无 miss
5. **探索型**: 解锁所有关卡、尝试所有场景

### 7.4 场景限定成就

```json
{
  "id": "letters-master",
  "scene": "letters",
  "name": "字母大师",
  "condition": { "metric": "sceneHits", "scene": "letters", "op": ">=", "value": 1000 }
}
```

> 实现说明: `sceneHits` 是首版**预留指标**,引擎需支持 per-scene hit 计数(放在 `achievementsStore.stats.sceneHits: Record<string, number>`)。第一版成就 JSON 可不包含这类规则,后续扩展时引擎读取 `scene` 字段并按 metric 路由到正确的 stat 字段。

## 八、视觉设计 (卡通风格)

### 8.1 色板

| 用途 | 颜色 |
|------|------|
| 主色 | `#FFB347` (橙黄) |
| 次色 | `#6BCB77` (草绿) |
| 强调 | `#FF6B6B` (珊瑚红) |
| 背景天空 | `#87CEEB` → `#FFB6C1` 渐变 |
| 土地 | `#8B4513` |
| 文本主 | `#3D2914` |
| 文本辅 | `#7A5C3F` |
| 阴影 | `rgba(0,0,0,0.15)` |

成就徽章色: 🥉 `#CD7F32` / 🥈 `#C0C0C0` / 🥇 `#FFD700` / 💎 `#B9F2FF`

### 8.2 字体

```css
--font-display: 'Baloo 2', 'Comic Sans MS', system-ui;
--font-ui: 'Nunito', system-ui, sans-serif;
--font-key: 'JetBrains Mono', monospace;
```

### 8.3 动画原则

| 类型 | 时长 | 缓动 | 用途 |
|------|------|------|------|
| 弹性进场 | 300ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 地鼠出现、按钮 |
| 平滑过渡 | 200ms | `ease-out` | 状态切换 |
| 弹跳反馈 | 400ms | overshoot | 击中特效 |
| 摇晃 | 500ms | `ease-in-out` | miss 反馈 |
| 旋转入场 | 600ms | `ease-out` | 成就解锁 |

### 8.4 视觉元素

- **小猴子 (yunhou)**: 棕色身体,粉色耳朵,长尾巴;idle 摆动,挥击时槌子旋转 360° + 身体前倾
- **地鼠**: 圆润造型,大眼睛,两颗门牙;身上"名牌"显示字符;hit 后碎成星星粒子
- **地洞**: 椭圆形土堆,带草叶装饰;12 个均匀分布在 4×3 网格
- **背景**: 远景山+树 (parallax 慢动),中景草地,前景地洞

### 8.5 布局

```
┌────────────────────────────────────────────────┐
│  HUD Top                                       │
│  ┌──────────┬──────────┬──────────┬─────────┐  │
│  │ Score    │ Combo    │ Avg Time │ Lives   │  │
│  └──────────┴──────────┴──────────┴─────────┘  │
│                                                │
│  Game Canvas                                   │
│  ┌──────────────────────────────────────────┐ │
│  │     [洞] [洞] [洞] [洞]                   │ │
│  │     [洞] [洞] [洞] [洞]                   │ │
│  │     [洞] [洞] [洞] [洞]                   │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Virtual Keyboard (可选, 折叠)                 │
└────────────────────────────────────────────────┘
```

### 8.6 响应式断点

- `≥ 1024px`: 全键盘可见,画布 16:9
- `768-1023px`: 键盘折叠为"点击展开"
- `< 768px`: 提示"请使用物理键盘"

## 九、虚拟键盘设计

### 9.1 布局

```
┌─────────────────────────────────────────┐
│  Esc  F1 F2 F3 F4  F5 F6 F7 F8  F9...  │
│  ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐  │
│  │` │1 │2 │3 │4 │5 │6 │7 │8 │9 │0 │- │  │
│  ├──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┤  │
│  │Tab │Q │W │E │R │T │Y │U │I │O │P │  │
│  ├─────┴┬─┴┬─┴┬─┴┬─┴┬─┴┬─┴┬─┴┬─┴┬─┴──┤  │
│  │ Caps │A │S │D │F │G │H │J │K │L │  │
│  ├──────┴──┬┴──┬┴──┬┴──┬┴──┬┴──┬┴──┬─┤  │
│  │ Shift  │Z │X │C │V │B │N │M │↑│  │
│  ├────────┴──┬┴───┴┬─┴──┬┴───┴───┴──┤  │
│  │ Ctrl  Win │Alt  │ Space │←↓→  │  │
│  └────────────┴────┴──────┴────────────┘  │
└─────────────────────────────────────────┘
```

### 9.2 按键交互

- **物理键盘按下** → 虚拟键盘对应按键高亮 + 缩放 0.95 (50ms)
- **虚拟键盘点击** → 触发键盘事件,等同于物理键盘
- **当前激活 mole 的字符** → 对应按键额外闪烁提示
- **配色**: 卡通按键,带 3D 凸起感 (box-shadow)

## 十、音效设计

| 事件 | 音效 | 时长 |
|------|------|------|
| hit | "咚!" (木槌) | 200ms |
| miss | "嗖" (划空) | 300ms |
| combo ≥ 10 | "叮!" | 100ms |
| 成就解锁 | 上行音阶 | 800ms |
| 关卡通过 | 胜利号角 | 1.5s |
| 关卡失败 | 下行音阶 | 1.0s |
| 背景音乐 | 卡通轻快 | 循环 |

**音效实现**: Web Audio API + 程序化生成,或预生成 OGG/WebM 按需加载。

## 十一、扩展点 (后续无需重构)

| 扩展项 | 改动位置 | 改动范围 |
|--------|---------|---------|
| 加新关卡 | `data/levels/` | 新增 JSON |
| 加新成就 | `data/achievements.json` | 新增规则 |
| 加新场景 | `src/scenes/` + `data/scenes/` | 新增文件,不动核心 |
| 加新模式 | `src/modes/` | 新增文件,不动核心 |
| 接入真实账户系统 | `src/services/AccountClient.ts` | 替换 mock 实现 |
| 加新主题 | `src/styles/variables.css` | 加 `[data-theme]` 块 |
| 多语言 | `src/i18n/` | 新增字典 |
| 多人对战 | `src/modes/multiplayer.ts` + WebSocket | 新增 mode + 服务 |
| 排行榜 | `services/LeaderboardClient.ts` | 新增接口 + UI |
| 录屏回放 | `core/recorder.ts` | 新增 EventBus 中间件 |
| 关卡编辑器 | 新页面 `#/editor` | 新增页面 |
| 移动端虚拟键盘 | `input/touchKeyboard.ts` | 条件加载 |
| PWA / 离线 | `public/manifest.webmanifest` + service worker | 配置文件 |

## 十二、部署与构建

### 12.1 命令

```bash
npm run dev          # vite dev server
npm run build        # 输出到 dist/
npm run preview      # 本地预览生产构建
npm run test         # vitest 单元测试
npm run test:e2e     # playwright 端到端
```

### 12.2 Nginx 配置示例

```nginx
server {
  listen 80;
  server_name _;
  root /var/www/yunhou-dazi/dist;

  location / {
    try_files $uri $uri/ /index.html;  # SPA fallback
  }

  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

## 十三、关键类型定义

### 13.1 GameState

```typescript
interface GameState {
  status: 'idle' | 'playing' | 'paused' | 'won' | 'lost';
  currentLevel: number;
  score: number;
  combo: number;
  maxCombo: number;
  hits: number;
  misses: number;
  lives: number;
  elapsedMs: number;
  responseTimes: number[];
  activeMoles: Mole[];
  recentHitKey: string | null;
  startTime: number | null;
}
```

### 13.2 Mole

```typescript
interface Mole {
  id: string;
  holeIndex: number;        // 0-11
  key: string;              // 身上字符
  sceneId: string;          // 所属场景
  state: 'hidden' | 'rising' | 'active' | 'retreating' | 'hit';
  appearAt: number;
  hitAt: number | null;
}

interface LevelStats {
  levelId: number;
  score: number;
  hits: number;
  misses: number;
  maxCombo: number;
  avgResponseMs: number;
  durationMs: number;
}
```

### 13.3 LevelConfig

```typescript
interface LevelConfig {
  id: number;
  scene: string;            // 引用的 Scene.id
  name: string;
  duration: number;         // 关卡时长(秒)
  moles: {
    activeCount: number;             // 同时存在的地鼠数
    spawnInterval: [number, number]; // 生成间隔随机区间(ms)
    stayTime: number;                // active 状态停留时间(ms)
  };
  sceneConfig: Record<string, unknown>;  // 透传给 Scene 的配置
  difficulty: number;        // 1-10
  winCondition: { type: 'score' | 'hits'; target: number };
  loseCondition: { type: 'misses' | 'time'; max: number };
}
```

### 13.4 AccountClient

```typescript
interface AccountClient {
  getCurrentUser(): Promise<User | null>;
  login(credentials: LoginRequest): Promise<AuthResult>;
  logout(): Promise<void>;
  saveProgress(progress: UserProgress): Promise<void>;
  loadProgress(): Promise<UserProgress | null>;
  getAchievements(): Promise<Achievement[]>;     // 列出已解锁成就
  unlockAchievement(id: string): Promise<void>; // 服务端标记解锁
}
```

### 13.5 GameEvent

```typescript
type GameEvent =
  | { type: 'mole:spawn'; mole: Mole }
  | { type: 'mole:hit'; mole: Mole; responseMs: number }
  | { type: 'mole:miss'; holeIndex: number }
  | { type: 'mole:timeout'; mole: Mole }
  | { type: 'level:start'; levelId: number }
  | { type: 'level:complete'; stats: LevelStats }
  | { type: 'level:fail'; reason: string }
  | { type: 'achievement:unlocked'; id: string }
  | { type: 'key:press'; key: string }
  | { type: 'game:pause' }
  | { type: 'game:resume' };
```

## 十四、开发顺序建议

第一版交付顺序:

1. 项目脚手架 (Vite + TS + 目录结构)
2. 核心数据模型 (types/) + EventBus
3. Store + 中间件 (含本地存储)
4. 路由 + 页面骨架
5. 游戏循环 + Canvas 渲染骨架
6. 关卡系统 + 地鼠实体
7. 第一个场景 (letters) 完整实现
8. 输入控制器 + 虚拟键盘
9. 计分 + 反应时间统计
10. 成就引擎
11. 视觉打磨 (动画、特效)
12. 音效
13. 接入 AccountClient (mock)
14. 后续场景 (拼音/成语) 实现

## 十五、风险与待定项

| 项 | 状态 | 处理 |
|----|------|------|
| 成语场景的输入顺序 | 待定 | 输入任意顺序 vs 必须按顺序,需设计阶段确认 |
| 拼音的声调输入 | 待定 | 输入 1-4 数字 vs 用 v 代表 ü |
| 单词场景的难度分级 | 待定 | 词频 vs 字母组合复杂度 |
| 账户系统接入细节 | 待定 | mock 实现先,真实接口确认后替换 |
| 美术资源来源 | 待定 | 第一版用程序化 SVG 简化版,后续可换美术素材 |
| 国际化优先级 | 待定 | 第一版只做中文,后续加 en-US |
