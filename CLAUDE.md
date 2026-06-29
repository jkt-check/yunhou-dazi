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
| 音效 | Web Audio API (SFX/BGM/ambient, 程序化合成) + 预录音频文件 (TTS via HTMLAudioElement + bundled mp3, public/voice/) |
| 持久化 | localStorage (settings/achievements);session-only (game) |
| 测试 | Vitest + happy-dom |
| 别名 | `@/*` → `src/*` (tsconfig + vite.config) |

## 关键架构约束

### 1. 场景层 (Scene) 是横向扩展点
- 接口定义在 `src/scenes/types.ts`
- 加新场景 = 新建 `src/scenes/{pinyin,words,idioms}.ts` 实现 `Scene` 接口
- **场景注册统一在 `src/main.ts`**(不是各页面 import 调用)
- **引擎对场景无知** — 不允许在 `src/core/` 引入具体场景
- 关键接口方法: `getKeysPerMole()` / `generateKey(ctx)` / `renderKey()` / `matches()` / `getDifficultyMultiplier()`

### 2. 状态分层
- `settingsStore` (持久化): `volume` / `sfxEnabled` / `showVirtualKeyboard` / `theme` (`'default' | 'sepia' | 'ink'`)
- `gameStore` (会话): 当前局状态 — **不持久化**
- `achievementsStore` (持久化 + 云同步): `unlocked` + `stats` (totalHits/Misses/Score, bestCombo, bestAvgResponseMs)

### 3. Store middleware
- **关键**:`store.extend(mw)` 是 **in-place mutation**,返回同一引用
- 链式 `.extend(persistence).extend(sync)` 始终组合到同一 store
- middleware 签名: `(store: Store<T>) => void`,可返回 cleanup
- 注意: 老的"extend 返回新 store"语义已废弃,见 git log

### 4. 渲染层
- `src/render/renderer.ts` 是 Canvas 主循环,订阅 `gameStore.recentHitKey` 触发猴子挥锤
- 资源: `src/render/sprites/{monkey,mole,background}.ts` 都是程序化绘制 (无外部图片)
- 颜色集中在 `src/render/palette.ts`,与 `variables.css` 同步
- 网格常量在 `src/core/grid.ts` (HOLES_TOTAL=12, COLS=4, ROWS=3),render 与 spawner 共享
- `src/render/canvas.ts` 处理 DPR 缩放 + resize 监听,必须返回带 `destroy()` 的句柄

### 5. 路由生命周期
- 路由表在 `src/App.ts`
- 页面 handler **必须返回 `() => void` 清理函数**,否则会内存泄漏 (RAF / 事件监听)
- Router dispatch 时自动调用上一次的 cleanup

### 6. 输入层
- `src/core/inputController.ts` 是唯一入口,聚合物理键盘 + 虚拟键盘
- IME 防护: 必须包含 `if (e.isComposing || e.keyCode === 229 || e.repeat) return;`
- Escape = pause/resume 切换,不影响其他键

### 7. 安全
- 不要用 inline `onclick` / `onerror` 等 — CSP-unfriendly
- 用户/成就数据经 innerHTML 注入时,要么用 `textContent`,要么固定数据源
- 当前成就 JSON 是内部数据可控,无 XSS 风险;接真实账户系统后必须审计

## 视觉系统 (frontend-design 落地)

- **故事书调色板** 在 `src/styles/variables.css` + `src/render/palette.ts`:
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
- **主题**: `[data-theme]` 三种 (default/sepia/ink),由 settings 页切换

## 文件位置速查

| 关注点 | 路径 |
|--------|------|
| 类型定义 | `src/types/{game,user,api}.ts` |
| 游戏循环 | `src/core/engine.ts` |
| 地鼠实体 | `src/core/mole.ts` (状态机: rising→active→retreating→hit→hidden) |
| 关卡数据 | `data/levels/*.json` |
| 成就规则 | `data/achievements.json` |
| 成就引擎 | `src/achievements/engine.ts` (数据驱动 + `accumulateAchievementStats` reducer) |
| 网格常量 | `src/core/grid.ts` |
| 渲染色板 | `src/render/palette.ts` |
| 字符集 | `data/keysets.json` (结构化,目前未直接用 — 预留) |
| 音频引擎 | `src/audio/audioEngine.ts` |
| 首页 | `src/pages/home.ts` (锁定场景用 `data-locked` + `addEventListener`) |
| 游戏页 | `src/pages/game.ts` (集成 engine/renderer/input/audio/achievements) |
| 启动入口 | `src/main.ts` (注册场景 + 挂 middleware) |

## 开发命令

```bash
npm run dev      # http://localhost:5173
npm run build    # tsc --noEmit + vite build
npm test         # vitest run (当前 327 个测试)
```

## 设计偏差(已收口)

> 这些之前在 alignment 报告里列出,目前都已修复或标记为接受。

| 项 | 状态 | 备注 |
|----|------|------|
| BUG-1 totalHits 平方增长 | ✅ fixed | `accumulateAchievementStats` reducer,5 个回归测试 |
| BUG-2 renderer retreat 硬编码 | ✅ fixed | `RendererOpts.level`,5/3/2px font 也修了 |
| GAP-1 sync middleware 装在 throwaway | ✅ fixed | `extend()` 改为 in-place mutation |
| GAP-2 bgmEnabled 死字段 | ✅ fixed | 已从 store + UI 移除 |
| GAP-3 theme 是字面量 | ✅ fixed | union `'default' \| 'sepia' \| 'ink'`,3 主题 CSS 已实装 |
| `Math.floor(rng() * length)` 边界 | ✅ fixed | `randIndex()` clamp |
| persistence 初次重写浪费 | ✅ fixed | `hydrated` flag |
| renderer canvas 0 尺寸 | ✅ fixed | early-return |
| `reason: string` 自由字符串 | ✅ fixed | `FailReason` union |
| home.ts inline `onclick` | ✅ fixed | `data-locked` + `addEventListener` |
| `randFloat`/`pick`/`pickWeighted`/`createRng` 死代码 | ✅ removed | 仅留 `randInt`/`randIndex` |
| AccountClient `getAchievements`/`unlockAchievement` 未用 | ✅ removed | 流程走 sync → saveProgress |
| `确保Scenes已注册` 模块级 hack | ✅ fixed | 改为 `main.ts` 集中注册 |
| 路由表位置 | ✅ accepted | 在 `App.ts` 而非 `router/routes.ts`,更内聚 |
| `src/modes/classic.ts` 等 | ✅ accepted | spec 列了,实现 YAGNI |
| `tests/e2e/` | ✅ accepted | spec 标为"可选" |
| **Round 4**: calcStars 返回 0 for score-based levels | ✅ fixed | `calcStars(stats, winCondition)` 按 type 分支 |
| **Round 5**: persistence hydration clobber 缺失字段 | ✅ fixed | whitelist filter 加 `parsed[k] !== undefined` 守卫 |
| **Round 2**: audioDirector.stop() 漏调 stopBgm/stopAmbient | ✅ fixed | stop() 现在清理全部三层 (BGM/ambient/heartbeat) |
| **Round 3**: totalHits 因 level:complete 多 +1 | ✅ fixed | reducer 增加 `event` 参数,level:complete 跳过 +1 |

## 风格约束 (给后续 AI 协作)

1. **不要引入框架** (React/Vue/Svelte) — 架构明确选原生
2. **音效模块分层** — SFX/BGM/ambient 仍是程序化合成,TTS 走预录 mp3 (`public/voice/manifest.json` + `src/audio/speechEngine.ts`)
3. **不要"通用 AI 默认"配色** — 已锁定故事书调色板,新组件用 CSS 变量或 palette.ts
4. **场景扩展不动 core** — 通过 `Scene` 接口 + `main.ts` 注册
5. **关卡/成就扩展不动代码** — 加 JSON 文件即可
6. **测试用 Vitest** — happy-dom 环境,TDD 风格
7. **提交规范** — `<type>: <subject>`,type 用 `feat|fix|chore|docs|refactor|test`

## 详细文档

- 设计: `docs/superpowers/specs/2026-06-24-yunhou-typing-game-design.md`
- 实施计划: `docs/superpowers/plans/2026-06-24-yunhou-typing-game.md`
- 对齐审计: `docs/superpowers/reviews/2026-06-25-code-design-alignment-report.md`
- README: `README.md` (简版,详见文档)
