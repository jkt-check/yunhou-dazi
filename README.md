# 云猴打字 (Yunhou Typing Game)

一个基于 Vite + TypeScript 的卡通风格"打地鼠"打字游戏:小猴子挥槌打地鼠,每只地鼠身上背一个键盘字符,玩家按对应键命中。

> **设计方向**: 故事书插画 + 中式印章美学,纸纹理背景 + 朱砂红章字符,非通用 AI 默认配色。

## 快速开始

```bash
npm install
npm run dev      # 启动开发服务器 http://localhost:5173
npm run build    # 生产构建到 dist/
npm test         # 跑单元测试 (39 个)
```

## 项目结构

```
src/
├── core/          游戏引擎、地鼠实体、计分、生成器、关卡
├── scenes/        可插拔内容源 (letters 已实装;pinyin/words/idioms 预留)
├── render/        Canvas 渲染 + 精灵 + 调色板
├── audio/         Web Audio 程序合成音效
├── input/         物理键盘 + 虚拟键盘
├── ui/            DOM HUD + 通用弹窗
├── store/         自研 Store + middleware
├── services/      账户系统接口 + localStorage mock
├── achievements/  数据驱动成就引擎
├── router/        hash router
├── pages/         页面级视图
└── types/         类型定义
data/              关卡 / 成就 / 字符集 JSON
tests/unit/        Vitest 单元测试
```

## 架构亮点

- **场景可横向扩展**: 实现 `Scene` 接口 + 在 `main.ts` 注册一行,不动核心
- **数据驱动关卡/成就**: 加 JSON 文件即可,不动代码
- **本地优先 + 云同步**: 自研 Store + `persistence` + `sync` middleware
- **Canvas + DOM 混合**: 游戏画布用 Canvas 2D,菜单 HUD 用 DOM
- **故事书调色板**: `src/styles/variables.css` + `src/render/palette.ts` 双源锁定

## 文档

- [设计文档](docs/superpowers/specs/2026-06-24-yunhou-typing-game-design.md)
- [实施计划](docs/superpowers/plans/2026-06-24-yunhou-typing-game.md)
- [代码设计对齐审计](docs/superpowers/reviews/2026-06-25-code-design-alignment-report.md)
- [项目记忆 (CLAUDE.md)](CLAUDE.md)
