# QWERTY 字母场景设计 — 把地鼠钉到 Mac 键盘位置

> 日期: 2026-06-29
> 范围: 现有 letters scene 改造 + 架构层 hole-layout 抽象

## 1. 问题与目标

现有 letters scene (`src/scenes/letters.ts`) 的地鼠在 4×3 = 12 个均匀网格洞里随机钻出,字母内容由 `sceneConfig.pool` 随机分配,与屏幕位置完全解耦。

**目标**: 把字母和屏幕位置绑定 —— 屏幕上铺一块 26 个字母的 QWERTY 键盘(完整 Mac stagger 布局),每个字母位置固定显示自己的字母,**地鼠只从该字母在 QWERTY 上的位置钻出,且顶出的字母必须等于该位置**。这样孩子不是「找字母然后找键盘上对应键位」,而是「看地鼠位置 → 直接按那把键」,认知路径最短。

教学价值: 孩子通过空间映射学会真实 Mac 键盘布局,而不是被训练一套虚拟排布后还要二次迁移。

## 2. 已锁定的决策

| # | 决策 | 选择 |
|---|------|------|
| 1 | 同时显示的字母数量 | 全部 26 字母,从 Level 1 起就是完整 QWERTY |
| 2 | 场景策略 | 改造现有 letters scene,保留 Level 1 左手池渐进 |
| 3 | 静态键位 | **静态印章常驻 + 字母常显示**(键盘地图) |
| 4 | 静态键位视觉风格 | **圆形印章**(与 mole 身上红章风格一致) |
| 5 | QWERTY 几何 | **真实 Mac stagger**(Row 1 偏 0.5 键,Row 2 偏 1 键) |
| 6 | 池内/池外视觉 | **统一视觉**,不区分 |

## 3. 架构改动

### 3.1 新增类型 — `HoleLayout`

文件: `src/scenes/layout.ts`(**新**)

```ts
export interface HolePosition {
  /** 在 layout.positions 数组中的索引,稳定 ID */
  index: number;
  /** 该位置的字母 / 字符;letters scene 是 'A'..'Z' */
  letter: string;
  /** 行号 0..n-1;Row 0 = Q-P, Row 1 = A-L, Row 2 = Z-M */
  row: number;
  /** 列号 0..m-1(在同一 row 内) */
  col: number;
  /** 归一化 x 坐标 [0, 1],相对画布宽度 */
  xRatio: number;
  /** 归一化 y 坐标 [0, 1],相对画布高度 */
  yRatio: number;
}

export interface HoleLayout {
  positions: HolePosition[];
}
```

**位置坐标用 `ratio` 而不是绝对像素**,这样支持任意画布尺寸 / DPR 缩放。renderer 拿到 layout + 当前 canvas size 后,自己把 ratio 算成像素。

### 3.2 Scene 接口扩展

文件: `src/scenes/types.ts`

Scene 接口新增一个**必需**方法:

```ts
export interface Scene {
  // ...现有字段...

  /** 返回该场景的洞布局;不能返回 null/undefined */
  getHoleLayout(): HoleLayout;
}
```

letters / pinyin / words / idioms scene 都需要实现这个方法(场景横向扩展的强化)。

注: letters scene 重写前,旧的 letters.ts 4×3 模式不再保留 —— 本次设计是一次替换,不向后兼容老 letters scene。

### 3.3 QWERTY 布局数据

文件: `src/scenes/qwertyLayout.ts`(**新**)

26 个位置,参数化生成(数据驱动,但类型安全)。

布局参数(常量):
- `KEY_UNIT = 0.085`(每个键位 + gap 占 8.5% canvas 宽)
- `KEY_LEFT_MARGIN = 0.10`(Row 0 第一个键 x = 0.10)
- `ROW_Y_POSITIONS = [0.60, 0.72, 0.84]`(Row 0/1/2)
- `ROW_OFFSETS = [0.0, 0.5, 1.0]`(每行相对 Row 0 的半键偏移)
- `ROW_LETTERS = [['Q','W','E','R','T','Y','U','I','O','P'],
                  ['A','S','D','F','G','H','J','K','L'],
                  ['Z','X','C','V','B','N','M']]`

```ts
import type { HoleLayout, HolePosition } from './layout';

const KEY_UNIT = 0.085;
const KEY_LEFT_MARGIN = 0.10;
const ROW_Y = [0.60, 0.72, 0.84];
const ROW_OFFSET = [0.0, 0.5, 1.0];
const ROW_LETTERS: string[][] = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Z','X','C','V','B','N','M']
];

export const qwertyLayout: HoleLayout = (() => {
  const positions: HolePosition[] = [];
  let idx = 0;
  for (let row = 0; row < ROW_LETTERS.length; row++) {
    for (let col = 0; col < ROW_LETTERS[row].length; col++) {
      positions.push({
        index: idx++,
        letter: ROW_LETTERS[row][col],
        row,
        col,
        xRatio: KEY_LEFT_MARGIN + (col + ROW_OFFSET[row]) * KEY_UNIT,
        yRatio: ROW_Y[row]
      });
    }
  }
  return { positions };
})();
```

注意 `index` 在这里只是顺序 ID,不一定对应 row × 10,因为 Row 1 只有 9 字母。生成时用 `ROW_LETTERS.flatMap` 的全局 index 即可,后续 spawner 用这个 index 关联 positions[i]。

印章半径(给 renderer 用,不在 layout 里):`STATIC_KEY_RADIUS_RATIO = 0.030`(=canvas 宽 3%)。

### 3.4 grid.ts 改造

文件: `src/core/grid.ts`

**删除**:
```ts
export const HOLES_TOTAL = 12;
export const HOLES_COLS = 4;
export const HOLES_ROWS = 3;
```

**新增**:
```ts
import type { HoleLayout } from '@/scenes/layout';

export function layoutToPixels(
  layout: HoleLayout,
  w: number,
  h: number
): { x: number; y: number }[] {
  return layout.positions.map(p => ({
    x: p.xRatio * w,
    y: p.yRatio * h
  }));
}
```

### 3.5 spawner.ts 改造

文件: `src/core/spawner.ts`

`SpawnerConfig` 重新设计:

```ts
export interface SpawnerConfig {
  activeCount: number;
  spawnInterval: [number, number];
  sceneId: string;
  layout: HoleLayout;             // 关键:替换 HOLES_TOTAL
  pool: readonly string[];        // 允许的字母集合(来自 level.sceneConfig.pool)
}
```

构造函数从 `generate: () => string` callback 改为 `layout + pool`。`spawnOne()`:

```ts
private spawnOne() {
  const free: number[] = [];
  const positions = this.config.layout.positions;
  for (let i = 0; i < positions.length; i++) {
    if (this.occupiedHoles.has(i)) continue;
    if (!this.config.pool.includes(positions[i].letter)) continue;
    free.push(i);
  }
  if (free.length === 0) return;
  const hole = free[randIndex(free.length)];
  this.onSpawn(createMole({
    holeIndex: hole,
    key: positions[hole].letter,  // 关键:字母严格来自 layout
    sceneId: this.config.sceneId,
    now: this.now(),
    id: nextId('mole')
  }));
}
```

注意: **`config.generate` 字段被删除**。letters scene 的 `Scene.generateKey` 在本次设计中**未被 spawner 调用**,但仍保留 Scene 接口方法(供未来非键盘化场景使用,如 pinyin 池内随机)。letters scene 的 `generateKey` 保留实现,简单返回 `'A'` 作为兜底(实际不被使用)。

### 3.6 renderer.ts 改造

文件: `src/render/renderer.ts`

1. `RendererOpts` 增加 `layout: HoleLayout`
2. 删除 `getHolePos` 函数(原来基于 `HOLES_COLS/ROWS` 算)
3. 改用 `layoutToPixels(layout, w, h)` 算 26 个像素点
4. **新增静态层**:每帧在动画之前先画 26 个红色印章(独立函数 `drawStaticKeyboard(ctx, layout, positions)`)
5. 动态层(mole)按现有逻辑在静态层上画

静态印章绘制函数:
```ts
function drawStaticKey(ctx: CanvasRenderingContext2D, key: HolePosition, x: number, y: number) {
  const r = STATIC_KEY_RADIUS_RATIO * canvasW;
  ctx.save();
  // 印章白底
  ctx.fillStyle = PAPER_WARM;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  // 朱砂环
  ctx.strokeStyle = VERMILION; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  // 内细环
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, r - 4, 0, Math.PI * 2); ctx.stroke();
  // 字母
  ctx.fillStyle = VERMILION;
  ctx.font = 'bold 22px "JetBrains Mono", monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(key.letter, x, y + 1);
  ctx.restore();
}
```

字号 `22px` 比 mole 身上的 `28px` 小,确保 mole 顶出后视觉层级仍然 mole > static。

### 3.7 letters scene 适配

文件: `src/scenes/letters.ts`

```ts
import { qwertyLayout } from './qwertyLayout';

export const lettersScene: Scene = {
  id: 'letters',
  name: '英文字母',

  getHoleLayout() { return qwertyLayout; },

  getKeysPerMole() { return 1; },

  // 保留接口但 spawner 不再调用;v2 pinyin 池内随机可能复用
  generateKey(_ctx) { return 'A'; },

  renderKey(ctx, key, x, y) {
    // 与现有 renderKey 一致: mole 头顶大号朱砂印章(28px JetBrains Mono)
    // 坐标 x, y 由 renderer 在 layout.positions[holeIndex] 处传入
  },

  matches(input, target) {
    return input[0]?.toLowerCase() === target.toLowerCase();
  },

  getDifficultyMultiplier() { return 1.0; },
  getTauntText() { /* 现有 taunts 不变 */ }
};
```

### 3.8 engine.ts 接线

文件: `src/core/engine.ts`

engine 创建 spawner 时从 scene 拿 layout:

```ts
const layout = scene.getHoleLayout();
const spawner = new Spawner({
  layout,
  // ...
});
```

renderer 启动时也传 layout:

```ts
startRenderer({ canvas, scene, level, layout, bus });
```

### 3.9 game.ts 验证

文件: `src/pages/game.ts`

不需要改外部 API,只要确认 engine 内部已经读 scene.getHoleLayout()。

## 4. 数据流(一帧)

```
[启动]
Level JSON → engine init → scene.getHoleLayout() → qwertyLayout
                    ↓
              spawner({ layout, pool, ... })
              renderer({ scene, layout, level, ... })

[循环 tick]
spawner.tick(moles):
  1. 计算 occupiedHoles 集合
  2. 遍历 layout.positions[i]:
     - 如果 letter ∉ pool,跳过
     - 如果 i ∈ occupiedHoles,跳过
     - 否则加入 free[i]
  3. 随机选一个 free i,生成 mole:
     - holeIndex = i
     - key = positions[i].letter  ← 关键(字母与位置绑定)
     
renderer.render(moles):
  1. 画背景(草地 + 远山)
  2. 画静态键盘层(26 个印章,固定不动)
  3. 画 active moles(每个 mole 在 layout.positions[holeIndex] 位置升起)
  4. 画 HUD

[输入]
keydown('a') → inputController
  → 找到 moles 里 key === 'A' 的(因为字母已绑定,只可能匹配它的 QWERTY 位置)
  → 命中 → 标准 hit 流程
```

## 5. 视觉呈现

### 5.1 静态层
- 26 个圆形朱砂印章,圆心在 QWERTY 坐标
- 每个印章:白底(PAPER_WARM)+ 朱砂外环 + 内细环 + 朱砂字符(22px JetBrains Mono)
- 印章半径 ≈ canvas 宽 3%
- 三行,Row 0 在 y=0.60, Row 1 在 y=0.72, Row 2 在 y=0.84
- Row 1 相对 Row 0 x 偏 0.5 单位 (4.25% canvas 宽)
- Row 2 相对 Row 0 x 偏 1.0 单位 (8.5% canvas 宽)

### 5.2 Mole 动态层
- Mole 在它对应 `positions[i]` 处升起
- 升起时(200ms 从 rise 状态),mole 头顶红印章数字(28px,与现有 letter scene 字号一致)
- 命中后标准 HIT_MS 动画消失
- 静态印章在 mole 升起时被遮挡(后绘制 mole 覆盖前绘制 static)

### 5.3 HIT 反馈
- 命中:猴锤动画(沿用现有)+ mole 命中动画 + 静态印章短暂泛光(可选优化,v1 不做)
- Miss:飘字"哎?"+ misses +1(沿用现有)

### 5.4 主题
- 默认主题(default): 朱砂印章 + 棕色 mole + 暖纸底(现有调色板无变化)
- sepia / ink 主题:印章颜色相应切换(继承现有主题 token 系统)

## 6. 行为细节

### 6.1 池过滤语义
- Level 1 pool = `['A','S','D','F','G','Q','W','E','R','T','Z','X','C','V','B']` (现有左手字母集)
- spawner 只在 pool 内字母的位置生成 mole
- 池外位置(Q-P 之外的右半部分)永远不出现 mole,但静态印章仍显示
- Level 2 pool = 全 26,所有位置都可能生成 mole

### 6.2 字母大小写
- pool 用大写 'A'-'Z'
- layout.positions[].letter 也大写
- matches() 内部小写比较,输入 'a' 也能命中

### 6.3 单字母池
- 如果 pool = ['F'],所有 mole 都是 'F',但 mole 可能在多个位置(F=G,F=H 等位置,等等)
- 实际: pool 唯一性不强求(关卡设计层面避免)

### 6.4 性能
- 26 个静态印章每帧全量画;每帧 26 个简单的 fill/stroke/text,canvas 2D 完全无压力
- 不引入离屏缓存先不做(v1),性能不构成瓶颈

### 6.5 Dev / 调试
- engine 启动时打印 layout 总数 + 第一行 letter 预览(console.debug)
- spawner 过滤后池内位置数 = 0 时 console.warn(防止 pool 完全无效的退化场景)

## 7. 错误与边界

| 场景 | 行为 |
|------|------|
| Pool 为空 | spawner 不生成任何 mole;console.warn 一次 |
| Pool 含 layout 外字符('7','!' 等) | spawner 过滤时跳过该字符位置;不影响其它 |
| 所有允许位置都被占用(activeCount 满) | spawner 这 tick 不生成,等下一 tick |
| 画布 size 0 | renderer 提前 return(沿用现有早期逻辑) |
| Layout 缺失某字母位置 | 不该出现;layout 应保证完整 26 字母 |
| Pool 只有 1 个字母 | 合法;只会显示该字母的 mole(monotonous 但工作) |

## 8. 测试

### 8.1 单元测试

| Case | 模块 |
|------|------|
| qwertyLayout 有 26 个 positions | `qwertyLayout.test.ts` |
| QWERTY 第 0 个是 'Q',第 9 个是 'P',第 10 个是 'A'(Row 1 起点) | `qwertyLayout.test.ts` |
| Row 0/1/2 各自 y 坐标递增(y[0] < y[1] < y[2]) | `qwertyLayout.test.ts` |
| Row 1 起点 x 比 Row 0 大(0.5 偏移) | `qwertyLayout.test.ts` |
| Row 2 起点 x 比 Row 1 大(0.5 偏移) | `qwertyLayout.test.ts` |
| layoutToPixels 把 ratio 0.5/0.5 转成 w/2 / h/2 | `grid.test.ts` |
| Spawner 在 pool 包含位置内生成 | `spawner.test.ts`(新写) |
| Spawner 跳过 pool 外位置 | `spawner.test.ts` |
| Spawner pool = [] 时不抛异常 | `spawner.test.ts` |
| letters.scene.getHoleLayout() === qwertyLayout | `letters.test.ts`(新写) |
| letters.scene.getHoleLayout() !== undefined | `letters.test.ts` |
| 老 level-1/2/3 JSON 还能被解析(回归) | `levels.test.ts`(已有) |
| QWERTY 第 19 个是 'Z',第 25 个是 'M'(Row 2 终点) | `qwertyLayout.test.ts` |
| 每个 position 的 index 在 0..25 之间连续无 gap | `qwertyLayout.test.ts` |
| 26 个字母无重复(全字母表) | `qwertyLayout.test.ts` |
| layoutToPixels 输出长度等于 layout.positions.length | `grid.test.ts` |
| Spawner pool = [] 时不抛异常,直接退出 | `spawner.test.ts` |
| Spawner 生成的 key 严格等于 layout.positions[holeIndex].letter | `spawner.test.ts` |
| letters.scene.getHoleLayout() !== undefined 且 positions.length === 26 | `letters.test.ts`(新写) |

### 8.2 视觉验证(手动)
- 启动 dev server,进入 letters level 1,验证 26 印章可见并呈 QWERTY stagger
- 验证左半位置会出 mole,右半位置始终空(mole 不出但印章在)
- level 2 升级后,所有位置都可能出 mole
- 在 1280×720 与 1920×1080 两种 DPR 下视觉一致

## 9. 风险与权衡

| 风险 | 应对 |
|------|------|
| `HOLES_TOTAL` 删除后,某处还在 import | 全面 grep + 移除 import; build 验证 |
| renderer 新加静态层增加 draw call,潜在掉帧 | 26 次 fill/stroke,远低于 60fps 风险,可接受 |
| 现有 reduce 函数 miss / hit 反馈依赖 holeIndex 与位置关系 | holeIndex 含义不变(指向 layout.positions[i]),inputController 不需改 |
| Layout 写死 QWERTY,未来加 Dvorak / AZERTY 需要复制粘贴 | v1 接受;未来可在 `data/keyboard/` 下抽 JSON,这次不动 |
| 老 letters.ts 代码被覆盖,回滚成本 | git branch 单独做(feat/scene-keyboard) |

## 10. 实施顺序(独立 commit-ready 步骤)

1. `src/scenes/layout.ts` — 新增类型
2. `src/scenes/qwertyLayout.ts` — 新增数据
3. `src/scenes/types.ts` — Scene 接口加 getHoleLayout
4. `src/core/grid.ts` — 删除 const,新增 layoutToPixels
5. `src/scenes/letters.ts` — 实现 getHoleLayout + 调整 generateKey
6. `src/core/spawner.ts` — 接受 layout,过滤 pool
7. `src/render/renderer.ts` — 接收 layout,绘制静态印章层 + 动态 mole
8. `src/core/engine.ts` — 接线 layout 给 spawner/renderer
9. `src/pages/game.ts` — 验证不需改
10. 测试 — qwertyLayout.test / spawner.test / letters.test
11. 删除老 `HOLES_*` 引用、回归 build & dev
12. 手动视觉验证

## 11. 与现有约束的对齐

- ✅ "引擎对场景无知": scene.getHoleLayout 是注入式实现,engine/spawner/renderer 只依赖 `HoleLayout` 接口
- ✅ "场景可横向扩展": pinyin / words / idiom scene 各自实现自己的 layout
- ✅ "模块边界清晰": spawner / renderer 不知道 layout 是 QWERTY 还是方阵
- ✅ "印章 + 朱砂"美学: 静态印章完整继承现有 renderKey 样式
- ✅ "数据驱动关卡": letters-level-1/2/3 JSON 不需更改(只是 pool 继续生效)
- ✅ 视觉风格锁:沿用 paper / vermilion / ink / moss 调色板
