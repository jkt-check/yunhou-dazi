# 对齐审计报告

**日期**: 2026-06-25
**审查人**: 主控会话
**范围**: spec + plan + 实现代码 + 新建 CLAUDE.md 的整体一致性

---

## 总体结论

实现 **90% 对齐**,架构约束(场景层抽象、自研 Store、引擎对场景无知)全部落地。设计风格(故事书调色板、印章字符)按 frontend-design skill 走通。但有以下**未完成项和真 bug**需要在下一轮修。

| 类别 | 数量 |
|------|------|
| 关键 Bug | 2 |
| 未对齐 (功能缺失) | 3 |
| 架构漂移 (spec 计划里有但实际未实现) | 7 |
| 计划偏差 (spec 计划如此,但 spec 自带漂移) | 2 |
| 设计折中 (已知) | 5 |

---

## 1. 真 Bug (建议下轮立刻修)

### 🐛 BUG-1: `totalHits` 平方增长

**文件**: `src/pages/game.ts:149-162`

```ts
achievementsStore.set(prev => ({
  unlocked,
  stats: {
    ...prev.stats,
    totalHits: prev.stats.totalHits + gameState.hits,  // ❌ 累加当前局 hit 总数,而非 delta
    ...
  }
}));
```

每次 `mole:hit` 触发时,**累加的是当前局的 hits 总数**(已经是计数后的值),不是 `+1`。结果:
- 第 1 次 hit: totalHits += 1
- 第 2 次 hit: totalHits += 2
- 第 3 次 hit: totalHits += 3
- ...
- 第 N 次 hit: totalHits += N

→ `totalHits = N*(N+1)/2`,很快会因 hit-100 成就误触发而出问题。

**修复**: 应改为 `prev.stats.totalHits + 1` 或者维护一个 session 起始 baseline:

```ts
totalHits: prev.stats.totalHits + 1,
```

**严重程度**: 重要 — 影响 Profile 页面的"累计命中"统计语义。

---

### 🐛 BUG-2: `renderer.ts` retreat 进度硬编码 `2200ms`

**文件**: `src/render/renderer.ts:80`

```ts
else if (m.state === 'retreating') progress = Math.max(0, 1 - (age - (200 + 2200)) / 150);
```

但关卡的 `stayTime` 各不相同:
- Level 1: 3000ms (左手字母)
- Level 2: 2500ms (全字母)
- Level 3: 2200ms (数字初探)

→ Level 1/2 的地鼠在 active 阶段就用了 retreat 公式,会显示为 retreat 状态但还在 active 持续期内,造成视觉跳变。

**修复**: 让 renderer 拿到 level 配置,或用 `m.hitAt || (RISING_MS + stayTime)` 计算:

```ts
// 在 renderer.ts 顶部引入 RISING_MS,或让 rendererOpts 传 level
const stayTime = level.moles.stayTime;
const fullActiveMs = RISING_MS + stayTime;
progress = Math.max(0, 1 - (age - fullActiveMs) / RETREATING_MS);
```

**严重程度**: 重要 — 影响 Level 1/2 的视觉正确性。

---

## 2. 未对齐 (功能缺失)

### ⚠️ GAP-1: sync middleware 未连接 mockAccount

**Plan Task 33** 要求在 dev 模式下:
```ts
achievementsStore.extend(sync({ save: ..., load: ... }, { debounceMs: 3000 }));
```

**实际**: `src/main.ts` 只有 `mountApp`,没有导入 `sync` 也没有调用 `extend`。
`src/store/middleware/sync.ts` 存在并已实现,但**完全没被使用**。

**影响**: spec §3.1 承诺的"云端同步"在 dev 模式都不工作。

**修复**: 在 `src/main.ts` 加:
```ts
if (import.meta.env.DEV) {
  achievementsStore.extend(sync({...}, { debounceMs: 3000 }));
}
```

**严重程度**: 中 — 计划里写明要做但没做。

---

### ⚠️ GAP-2: `bgmEnabled` 设置是死字段

**文件**: `src/store/slices/settings.ts:7,15`

`bgmEnabled: boolean` 字段在 store 中存在,设置页有 checkbox 切换,**但代码里没有任何地方读取它**。因为 BGM 根本没实现。

**修复**: 二选一:
- A. 移除 `bgmEnabled` 字段直到 BGM 实现
- B. 实现 BGM 模块(`src/audio/bgm.ts`),遵循 spec §10 表格

**严重程度**: 低 — 但语义死代码对前端架构不好。

---

### ⚠️ GAP-3: `theme` 是字面量,无法切换

**文件**: `src/store/slices/settings.ts:9`

```ts
theme: 'default';  // 这是 type literal,不是 union
```

`theme` 字段类型是字面量 `'default'`,意味着 **TS 编译期禁止**赋任何其他值。即使将来想加 `[data-theme="dark"]`,也要先改 type。

**修复**:
```ts
theme: 'default' | 'dark' | 'sepia';  // 先把 union 打开
```
并在 `global.css` 加对应的主题变量块。

**严重程度**: 低 — 但前置条件,后续做主题时必须先开 type。

---

## 3. 架构漂移 (Spec 列了但没实现)

| Spec 路径 | 状态 | 说明 |
|----------|------|------|
| `src/scenes/{pinyin,words,idioms}.ts` | ❌ 未建 | spec 明确标为"预留",**接受** |
| `src/modes/classic.ts` | ❌ 未建 | spec §2.1 列了 modes 层;第一版只有一种模式,引擎逻辑内置,**接受** |
| `src/ui/menu.ts` | ❌ 未建 | 实际是 `src/pages/home.ts` 充当,**接受**(菜单功能在 home 完成) |
| `src/ui/settings.ts` / `src/ui/achievements.ts` / `src/ui/modal.ts` | ❌ 未建 | 实际分别在 `src/pages/` 和 `src/ui/components/modal.ts`,**接受** |
| `src/ui/components/{button,icon,progressBar}.ts` | ❌ 未建 | 当前用 inline HTML/CSS,**接受**(组件抽象 YAGNI) |
| `src/store/slices/user.ts` | ❌ 未建 | 用户信息直接由 `mockAccount.ts` 管,**接受** |
| `src/services/api.ts` | ❌ 未建 | HTTP 客户端暂未需要,**接受**(等接真实账户再补) |
| `src/audio/{sounds,bgm}.ts` | ❌ 未建 | `sounds` 内联在 audioEngine;`bgm` 未实现,**接受**(spec §10 表格里 BGM 是单独的) |
| `src/render/effects.ts` | ❌ 未建 | 粒子特效未实现,**接受**(spec 没强制 v1) |
| `src/achievements/{rules,rewards}.ts` | ❌ 未建 | `rules` 是 `data/achievements.json` 数据驱动;`rewards` 系统未实现,**接受** |
| `src/router/routes.ts` | ❌ 未建 | 路由表移到 `src/App.ts`,**接受**(spec 计划的位置错了,实际更内聚) |
| `data/scenes/letters.json` | ❌ 未建 | 场景元数据内联在 `src/scenes/letters.ts`,**接受** |
| `tests/e2e/` | ❌ 未建 | Playwright 没配置,**接受**(spec 标为"可选") |
| `src/assets/` | ❌ 未建 | 静态资源全部用 Canvas 程序化绘制 + CSS,**接受** |

这些大部分是 spec 计划里给了详细目录清单,但实现中**出于 YAGNI 把粒度合并了**。建议:
- 短期不动 (都是合理的合并)
- 长期如果模块膨胀(比如 modes 多了),再按 spec 拆分

---

## 4. Spec 自带漂移 (已在 spec 中标注)

这些是 spec 在 v0.9 → v1.0 时为了"测试能过"主动调整的,已在 spec §5.5 注释中说明:

| 项目 | Spec 原文 | 实际代码 | 处理 |
|------|----------|---------|------|
| 计分阈值 | spec 注释说明用 `500/800/1200ms` | `scoring.ts` 用 500/800/1200 | ✅ 一致 |
| `GameState.attempts` | spec §13.1 列了字段 | 实现无该字段 | ✅ spec 已删除 |

---

## 5. 设计折中 (已知并接受)

| 折中 | 说明 |
|------|------|
| `home.ts` 用 inline `onclick="event.preventDefault()"` | CSP-unfriendly,后续替换 |
| `settings.ts` 不订阅 store 变化 | 切换路由时重新渲染,所以是 OK 的 |
| 路由表位置 | 实际在 `App.ts` 而非 `router/routes.ts`,更内聚 |
| `data/keysets.json` 存在但未使用 | 预留,等场景多起来再 wire |
| 字符池配置放在 `level.sceneConfig.pool` | 没用 `keysets.json`,因为 level 粒度更合适 |

---

## 6. CLAUDE.md 对齐情况

新写 `CLAUDE.md` 包含:
- ✅ 项目身份 + 技术栈速查
- ✅ 架构硬约束(场景抽象、状态分层、路由生命周期、IME 防护)
- ✅ 视觉系统(调色板、字体、印章、动画)集中在 `variables.css`
- ✅ 文件位置速查表
- ✅ **包含本审计的 2 个 bug + 3 个 gap 的清单**,后续会话能直接看到

**注意**: CLAUDE.md 列出 BUG-1/BUG-2/GAP-1/GAP-2/GAP-3,作为下一轮修复的明确目标。

---

## 7. 建议的下轮动作

按优先级:

1. **必修**: 修 BUG-1 (`totalHits` 平方增长) - 影响数据正确性
2. **必修**: 修 BUG-2 (`renderer.ts` retreat 硬编码) - 影响 Level 1/2 视觉
3. **应修**: 接 sync middleware (GAP-1) - 完成 plan Task 33
4. **小修**: 移除或实现 `bgmEnabled` (GAP-2) + 打开 `theme` union (GAP-3)
5. **可选**: 把 `home.ts` inline `onclick` 改为 `addEventListener`

如果只修 #1 + #2,游戏的数据正确性和视觉一致性就能完整。
