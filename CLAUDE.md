# CLAUDE.md — 云猴打字 (Yunhou Typing Game) 项目记忆

> 给后续会话用的项目上下文锚点。先读 spec/plan,再看本文件。

## 项目身份

- **产品**: 网页版卡通风格"打地鼠"打字游戏 — 地鼠身上背键盘字符,玩家按对应键打中
- **核心循环**: 关卡加载 → 地鼠生成 → 按键命中 → 计分/连击/反应时间统计 → 通关/失败
- **第一版范围**: 英文字母场景 + 拼音/单词/成语场景为架构预留
- **设计原则** (来自 spec §1.2):
  - 本地优先 + 云同步
  - 场景可横向扩展 (数据驱动)
  - 模块边界清晰 (引擎对场景无知, UI 不直接调 Service)
  - 故事书插画风格 + 中式印章美学 (≠通用奶油+衬线+赤土的 AI 默认)

## 技术栈

| 维度 | 选型 |
|------|------|
| 构建 | Vite 5 + TypeScript 5 (strict) |
| UI | 原生 TS + DOM,无框架 |
| 渲染 | Canvas 2D (游戏) + DOM (菜单/HUD) |
| 状态 | 自研 Store (`src/store/createStore.ts`) + middleware (persistence/sync/logger) |
| 路由 | 自研 hash router (`src/router/router.ts`) |
| 音效 | Web Audio API,程序化合成 (无音频文件) |
| 持久化 | localStorage (settings/achievements);session-only (game) |
| 测试 | Vitest + happy-dom |
| 别名 | `@/*` → `src/*` (tsconfig + vite.config) |

## 关键架构约束

### 1. 场景层 (Scene) 是横向扩展点
- 接口定义在 `src/scenes/types.ts`
- 加新场景 = 新建 `src/scenes/{pinyin,words,idioms}.ts` 实现 `Scene` 接口 + `registerScene(xxx)`
- **引擎对场景无知** — 不允许在 `src/core/` 引入具体场景
- 关键接口方法: `getKeysPerMole()` / `generateKey(ctx)` / `renderKey()` / `matches()` / `getDifficultyMultiplier()`

### 2. 状态分层
- `settingsStore` (持久化): volume / sfxEnabled / bgmEnabled / showVirtualKeyboard / theme
- `gameStore` (会话): 当前局状态 — **不持久化**
- `achievementsStore` (持久化): unlocked + stats (totalHits/Misses/Score, bestCombo, bestAvgResponseMs)

### 3. 渲染层
- `src/render/renderer.ts` 是 Canvas 主循环,订阅 `gameStore.recentHitKey` 触发猴子挥锤
- 资源: `src/render/sprites/{monkey,mole,background}.ts` 都是程序化绘制 (无外部图片)
- `src/render/canvas.ts` 处理 DPR 缩放 + resize 监听,必须返回带 `destroy()` 的句柄

### 4. 路由生命周期
- 路由表在 `src/App.ts` (注意: **不在** `src/router/routes.ts`,那是 spec 计划的位置)
- 页面 handler **必须返回 `() => void` 清理函数**,否则会内存泄漏 (RAF / 事件监听)
- Router dispatch 时自动调用上一次的 cleanup

### 5. 输入层
- `src/core/inputController.ts` 是唯一入口,聚合物理键盘 + 虚拟键盘
- IME 防护: 必须包含 `if (e.isComposing || e.keyCode === 229 || e.repeat) return;`
- Escape = pause/resume 切换,不影响其他键

## 视觉系统 (frontend-design 落地)

- **故事书调色板** 在 `src/styles/variables.css`:
  - 主背景 paper `#F5EBD7` (暖纸色,带 CSS dot 纹理)
  - 墨色 ink `#2C1810` (永远用 ink 做轮廓)
  - 朱砂 vermilion `#C44536` (印章 / miss)
  - 赭石 ochre `#D4673A` (猴子)
  - 苔绿 moss `#5A8068` (草地)
  - 雾蓝 haze `#7BA7BC` (远山)
  - 蜜金 honey `#DAA520` (成就解锁)
- **字体**:
  - `--font-display`: ZCOOL KuaiLe (中文手写标题)
  - `--font-display-en`: Fraunces (英文衬线)
  - `--font-key`: JetBrains Mono (等宽,字符清晰)
- **印章字符**: 地鼠身上字符用圆形红章样式 (白底 + 朱砂字 + 朱砂环),见 `src/scenes/letters.ts:renderKey`
- **弹性动画**: 全局 `cubic-bezier(0.34, 1.56, 0.64, 1)`,见 `animations.css`

## 文件位置速查

| 关注点 | 路径 |
|--------|------|
| 类型定义 | `src/types/{game,user,api}.ts` |
| 游戏循环 | `src/core/engine.ts` |
| 地鼠实体 | `src/core/mole.ts` (状态机: rising→active→retreating→hit→hidden) |
| 关卡数据 | `data/levels/*.json` |
| 成就规则 | `data/achievements.json` |
| 成就引擎 | `src/achievements/engine.ts` (数据驱动,条件 DSL: `{metric, op, value}`) |
| 字符集 | `data/keysets.json` (结构化,代码中目前没直接用 — 预留) |
| 首页 | `src/pages/home.ts` (注意: 用 `onclick="event.preventDefault()"` 而非 `addEventListener` — 是已知小毛病) |
| 游戏页 | `src/pages/game.ts` (这是最复杂的页面, 集成 engine/renderer/input/audio/achievements) |

## 开发命令

```bash
npm run dev      # http://localhost:5173
npm run build    # tsc --noEmit + vite build
npm test         # vitest run (30 tests)
```

## 已知偏差 / 后续待办

> 这些是 spec vs 代码的实际差异,不是 bug,是经过讨论保留的设计折中。

| 类别 | 偏差 | 处理 |
|------|------|------|
| Spec §5.5 计分阈值 | 实测用 500/800/1200ms (spec §5.5 已同步更新) | 已对齐 |
| GameState.attempts | spec 原始 §13.1 有,实现去掉了 (derived from hits+misses) | 接受 |
| `bgmEnabled` setting | store 里有字段,但**没实现 BGM** | 后续实现时再接 |
| `theme: 'default'` | 是字面量,目前**没有主题切换** | 后续加 `[data-theme]` 时激活 |
| `data/scenes/*.json` | spec 列了,实现里场景内联在 `src/scenes/*.ts` | 接受,场景数量小 |
| 路由表位置 | spec 计划放在 `src/router/routes.ts`,**实现在 `src/App.ts`** | 接受,可读性更好 |
| `home.ts` 用 inline `onclick` | spec §7.1 没要求,但 CSP-unfriendly | 小问题,后续替换为 addEventListener |
| `renderer.ts:80` 硬编码 `2200ms` | retreat 进度用硬编码常量,不是 `level.moles.stayTime` | **Bug**: 不同关卡 stayTime 不同时会错 |
| `game.ts:153` `totalHits` 累加 | 每次 hit 累加**当前** hits,而非 +1,导致平方增长 | **Bug**: 待修 |

## 风格约束 (给后续 AI 协作)

1. **不要引入框架** (React/Vue/Svelte) — 架构明确选原生
2. **不要引入音频文件** — 保持程序化合成
3. **不要"通用 AI 默认"配色** — 已锁定故事书调色板,新组件用 CSS 变量
4. **场景扩展不动 core** — 通过 `Scene` 接口 + `registerScene`
5. **关卡/成就扩展不动代码** — 加 JSON 文件即可
6. **测试用 Vitest** — happy-dom 环境,TDD 风格
7. **提交规范** — `<type>: <subject>`,type 用 `feat|fix|chore|docs|refactor|test`

## 详细文档

- 设计: `docs/superpowers/specs/2026-06-24-yunhou-typing-game-design.md`
- 实施计划: `docs/superpowers/plans/2026-06-24-yunhou-typing-game.md`
