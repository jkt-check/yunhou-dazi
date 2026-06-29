# Monkey Voice Timing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把猴子配音从 9 个时机收紧到 4 个仪式性节点 (开场 / 末 10s / 通关 / 失败),中途完全静音。

**Architecture:** 单点改动集中在 `audioDirector` 事件路由层 + 一处 `voiceLines` 数据新增。零架构变化,零接口变化,零新依赖。`generate-voice-pack.mjs` 是 source-of-truth 同步工具,改 `voiceLines.ts` 后跑它即可自动补 `public/voice/monkeyGreeting/*.mp3` 和 `manifest.json`。

**Tech Stack:** TypeScript 5 strict / Vitest / 既有 `scripts/generate-voice-pack.mjs` (Node 22+)

**Reference spec:** `docs/superpowers/specs/2026-06-29-monkey-voice-timing.md`

---

## Task 1: Add `monkeyGreeting` to voice data + type union

**Files:**
- Modify: `src/speech/voiceLines.ts:13-25` (type union), `src/speech/voiceLines.ts:44-168` (VOICE_LINES map)
- Modify: `tests/unit/voiceLines.test.ts:4-8` (ALL_KINDS), `tests/unit/voiceLines.test.ts:121-131` (KNOWN_MONKEY list), `tests/unit/voiceLines.test.ts:92-114` (new test)

- [ ] **Step 1: Write the failing test — add `monkeyGreeting` to `ALL_KINDS`**

In `tests/unit/voiceLines.test.ts`, replace the `ALL_KINDS` array (line 4-8):

```ts
const ALL_KINDS: VoiceLineKind[] = [
  'monkeyHit', 'monkeyMiss', 'monkeyCombo2', 'monkeyCombo3', 'monkeyCombo4',
  'monkeyWin', 'monkeyLose', 'monkeyLowLife', 'monkeyFinale',
  'monkeyGreeting',
  'moleHit', 'moleTaunt'
];
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/voiceLines.test.ts -t "every kind has a non-empty pool"`
Expected: FAIL with `Type '"monkeyGreeting"' is not assignable to type 'VoiceLineKind'` (TS error from `ALL_KINDS: VoiceLineKind[]`)

- [ ] **Step 3: Add `'monkeyGreeting'` to `VoiceLineKind` union**

In `src/speech/voiceLines.ts`, in the `VoiceLineKind` union (line 13-25), add `monkeyGreeting` after `monkeyFinale` (alphabetical-ish position; matches group ordering: monkey* kinds before mole* kinds):

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
  | 'monkeyGreeting'   // ← added
  | 'moleHit'
  | 'moleTaunt';
```

- [ ] **Step 4: Add `monkeyGreeting` pool to `VOICE_LINES`**

In `src/speech/voiceLines.ts`, in the `VOICE_LINES` map, **before the `// ── Mole: pain` comment** (after `monkeyFinale:` block ending line 139, before `moleHit:` block starting line 142), insert:

```ts
  // ── Monkey: 开场白 (5 句池, 拉开节奏) ─────────────────────
  monkeyGreeting: [
    { text: '准备好啦?', voice: 'cute_boy',   emotion: 'excited', speed: 1.0  },
    { text: '开始吧',    voice: 'clever_boy', emotion: 'happy',   speed: 1.0  },
    { text: '来啦',      voice: 'cute_boy',   emotion: 'happy',   speed: 1.05 },
    { text: '冲一冲',    voice: 'cute_boy',   emotion: 'excited', speed: 1.1  },
    { text: '看你的啦',  voice: 'clever_boy', emotion: 'happy',   speed: 1.0  },
  ],
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/unit/voiceLines.test.ts`
Expected: PASS (all 5 `pickLine` + `voiceLines` data tests green)

- [ ] **Step 6: Add emotion test for `monkeyGreeting`**

In `tests/unit/voiceLines.test.ts`, in the `describe('monkey voice lines', ...)` block (line 92-114), add a new `it` block at the end (before the closing `});` on line 114):

```ts
  it('monkeyGreeting lines use happy/excited emotion (welcoming, not anxious)', () => {
    VOICE_LINES.monkeyGreeting.forEach(line => {
      expect(['happy', 'excited', 'neutral']).toContain(line.emotion);
    });
  });
```

- [ ] **Step 7: Add `monkeyGreeting` to voice-ids whitelist test**

In `tests/unit/voiceLines.test.ts`, in the `'monkey lines use cute_boy or clever_boy voices'` test (line 121-131), update the `monkeyKinds` array to include `monkeyGreeting`:

```ts
    const monkeyKinds: VoiceLineKind[] = [
      'monkeyHit', 'monkeyMiss', 'monkeyCombo2', 'monkeyCombo3', 'monkeyCombo4',
      'monkeyWin', 'monkeyLose', 'monkeyLowLife', 'monkeyFinale',
      'monkeyGreeting',
    ];
```

- [ ] **Step 8: Run tests to verify all pass**

Run: `npm test -- tests/unit/voiceLines.test.ts`
Expected: PASS (6 tests in `pickLine` + 4 in `monkey voice lines` + 2 in valid voice ids = 12 tests total)

- [ ] **Step 9: Commit**

```bash
git add src/speech/voiceLines.ts tests/unit/voiceLines.test.ts
git commit -m "feat(voice): add monkeyGreeting kind + 5 opening lines

- Add 'monkeyGreeting' to VoiceLineKind union
- Add 5-line pool: '准备好啦?' / '开始吧' / '来啦' / '冲一冲' / '看你的啦'
- Update voiceLines tests to cover the new kind

Fired on level:start in follow-up task.
Spec: docs/superpowers/specs/2026-06-29-monkey-voice-timing.md
"
```

---

## Task 2: Route `level:start` to `voice.speak('monkeyGreeting')`

**Files:**
- Modify: `src/audio/audioDirector.ts:80-84` (level:start subscription)
- Modify: `src/audio/audioDirector.test.ts:124-131` (level:start test)

- [ ] **Step 1: Update failing test — add greeting assertion to level:start**

In `src/audio/audioDirector.test.ts`, find the test starting at line 124:

```ts
  it('routes level:start to audio.startBgm + audio.startAmbient + audio.playStartJingle', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'level:start', levelId: 1 });
    expect(audioMock.playStartJingle).toHaveBeenCalled();
    expect(audioMock.startBgm).toHaveBeenCalled();
    expect(audioMock.startAmbient).toHaveBeenCalled();
    d.stop();
  });
```

Replace with:

```ts
  it('routes level:start to audio.startBgm + audio.startAmbient + audio.playStartJingle + voice.speak("monkeyGreeting")', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'level:start', levelId: 1 });
    expect(audioMock.playStartJingle).toHaveBeenCalled();
    expect(audioMock.startBgm).toHaveBeenCalled();
    expect(audioMock.startAmbient).toHaveBeenCalled();
    expect(voice.speak).toHaveBeenCalledWith('monkeyGreeting');
    d.stop();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/audio/audioDirector.test.ts -t "level:start"`
Expected: FAIL with `expect(voice.speak).toHaveBeenCalledWith('monkeyGreeting')` — calls received: `[]`

- [ ] **Step 3: Add `voice.speak('monkeyGreeting')` to `level:start` subscription**

In `src/audio/audioDirector.ts`, find the `level:start` subscription (line 80-84):

```ts
  unsubs.push(bus.on('level:start', () => {
    if (sfxOn()) audio.playStartJingle();
    if (bgmOn()) audio.startBgm();
    if (ambientOn()) audio.startAmbient();
  }));
```

Replace with:

```ts
  unsubs.push(bus.on('level:start', () => {
    if (sfxOn()) audio.playStartJingle();
    if (bgmOn()) audio.startBgm();
    if (ambientOn()) audio.startAmbient();
    // New in v2 timing: opening greeting (5-line pool) — ceremony moment
    if (voiceOn()) voice.speak('monkeyGreeting');
  }));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/audio/audioDirector.test.ts -t "level:start"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/audio/audioDirector.ts src/audio/audioDirector.test.ts
git commit -m "feat(audio): fire monkeyGreeting on level:start

Fires alongside start jingle / BGM / ambient. v2 timing tightening:
monkey now opens each level with 1 of 5 greeting lines.

Spec: docs/superpowers/specs/2026-06-29-monkey-voice-timing.md
"
```

---

## Task 3: Remove in-game voice triggers (keep SFX)

**Files:**
- Modify: `src/audio/audioDirector.ts:42-45` (mole:miss), `src/audio/audioDirector.ts:53-66` (combo:tier-up), `src/audio/audioDirector.ts:126-131` (life:warning)
- Modify: `src/audio/audioDirector.test.ts:252-315` (delete 4 voice tests)

- [ ] **Step 1: Delete 4 obsolete voice routing tests**

In `src/audio/audioDirector.test.ts`, find and **delete** the following 4 `it` blocks in the `describe('voice routing', ...)` section:

1. **Delete lines 252-257** — `'combo:tier-up (tier 2) triggers monkeyCombo2 cheer'`:
```ts
    it('combo:tier-up (tier 2) triggers monkeyCombo2 cheer', () => {
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'combo:tier-up', tier: 2 });
      expect(voice.speak).toHaveBeenCalledWith('monkeyCombo2');
      d.stop();
    });
```

2. **Delete lines 259-264** — `'combo:tier-up (tier 3) triggers monkeyCombo3 cheer'`

3. **Delete lines 266-271** — `'combo:tier-up (tier 4) triggers monkeyCombo4 cheer'`

4. **Delete lines 273-278** — `'combo:tier-up (tier 1) does NOT trigger any monkey cheer'`

5. **Delete lines 280-285** — `'mole:miss triggers voice.speak("monkeyMiss") when voiceEnabled'`:
```ts
    it('mole:miss triggers voice.speak("monkeyMiss") when voiceEnabled', () => {
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'mole:miss', holeIndex: 0 });
      expect(voice.speak).toHaveBeenCalledWith('monkeyMiss');
      d.stop();
    });
```

6. **Delete lines 309-315** — `'life:warning triggers voice.speak("monkeyLowLife") + audio.setLowLifeMode(true)'`:
```ts
    it('life:warning triggers voice.speak("monkeyLowLife") + audio.setLowLifeMode(true)', () => {
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'life:warning', lives: 2 });
      expect(voice.speak).toHaveBeenCalledWith('monkeyLowLife');
      expect(audioMock.setLowLifeMode).toHaveBeenCalledWith(true);
      d.stop();
    });
```

After deletion, **replace** the 6 deleted blocks with a single new test at the position of the first deletion (preserves test grouping):

```ts
    it('combo:tier-up does NOT trigger any voice (SFX + BGM only — v2 timing)', () => {
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'combo:tier-up', tier: 3 });
      expect(voice.speak).not.toHaveBeenCalled();
      expect(audioMock.tierUp).toHaveBeenCalled();
      expect(audioMock.setBgmTier).toHaveBeenCalledWith(3);
      d.stop();
    });

    it('mole:miss does NOT trigger any voice (SFX only — v2 timing)', () => {
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'mole:miss', holeIndex: 0 });
      expect(voice.speak).not.toHaveBeenCalled();
      expect(audioMock.miss).toHaveBeenCalled();
      d.stop();
    });

    it('life:warning does NOT trigger any voice (heartbeat SFX only — v2 timing)', () => {
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'life:warning', lives: 2 });
      expect(voice.speak).not.toHaveBeenCalled();
      expect(audioMock.setLowLifeMode).toHaveBeenCalledWith(true);
      d.stop();
    });
```

- [ ] **Step 2: Run tests to verify SFX-only assertions pass**

Run: `npm test -- src/audio/audioDirector.test.ts -t "does NOT trigger any voice"`
Expected: PASS (3 new tests, all assert `voice.speak).not.toHaveBeenCalled()` while SFX still fires)

- [ ] **Step 3: Remove `voice.speak('monkeyMiss')` from `mole:miss` subscription**

In `src/audio/audioDirector.ts`, find the `mole:miss` subscription (line 42-45):

```ts
  unsubs.push(bus.on('mole:miss', () => {
    if (sfxOn()) audio.miss();
    if (voiceOn()) voice.speak('monkeyMiss');
  }));
```

Replace with:

```ts
  unsubs.push(bus.on('mole:miss', () => {
    if (sfxOn()) audio.miss();
    // v2 timing: no monkey miss-encouragement voice (SFX miss sound is enough)
  }));
```

- [ ] **Step 4: Remove `voice.speak(cheer)` from `combo:tier-up` subscription**

In `src/audio/audioDirector.ts`, find the `combo:tier-up` subscription (line 53-66):

```ts
  unsubs.push(bus.on('combo:tier-up', (e) => {
    if (sfxOn()) {
      audio.tierUp();
      audio.setBgmTier(e.tier);  // enable more BGM tracks as tier climbs
    }
    if (voiceOn()) {
      // Tier-specific cheers (escalating energy)
      const cheer =
        e.tier === 4 ? 'monkeyCombo4' :
        e.tier === 3 ? 'monkeyCombo3' :
        e.tier === 2 ? 'monkeyCombo2' : null;
      if (cheer) voice.speak(cheer);
    }
  }));
```

Replace with:

```ts
  unsubs.push(bus.on('combo:tier-up', (e) => {
    if (sfxOn()) {
      audio.tierUp();
      audio.setBgmTier(e.tier);  // enable more BGM tracks as tier climbs
    }
    // v2 timing: no per-tier cheer voice (BGM escalation carries the energy)
  }));
```

- [ ] **Step 5: Remove `voice.speak('monkeyLowLife')` from `life:warning` subscription**

In `src/audio/audioDirector.ts`, find the `life:warning` subscription (line 126-131):

```ts
  unsubs.push(bus.on('life:warning', (e) => {
    if (sfxOn() && e.lives <= 2 && !audio.isLowLifeActive()) {
      audio.setLowLifeMode(true);
    }
    if (voiceOn()) voice.speak('monkeyLowLife');
  }));
```

Replace with:

```ts
  unsubs.push(bus.on('life:warning', (e) => {
    if (sfxOn() && e.lives <= 2 && !audio.isLowLifeActive()) {
      audio.setLowLifeMode(true);
    }
    // v2 timing: no low-life voice warning (heartbeat SFX already signals danger)
  }));
```

- [ ] **Step 6: Update `voice.speak is NOT called when voiceEnabled is false` test**

In `src/audio/audioDirector.test.ts`, find the test (line 324-336) starting with:

```ts
    it('voice.speak is NOT called when voiceEnabled is false', () => {
      settings = { get: () => ({ sfxEnabled: true, bgmEnabled: true, voiceEnabled: false, ambientEnabled: true }) };
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'mole:hit', mole: {} as any, responseMs: 200, tier: 1 });
      bus.emit({ type: 'mole:miss', holeIndex: 0 });
      bus.emit({ type: 'mole:taunt', mole: {} as any, text: 'x' });
      bus.emit({ type: 'level:complete', stats: {} as any });
      bus.emit({ type: 'level:fail', reason: 'lives_exhausted' });
      bus.emit({ type: 'life:warning', lives: 1 });
      bus.emit({ type: 'level:finale', remainingMs: 5000 });
      expect(voice.speak).not.toHaveBeenCalled();
      d.stop();
    });
```

Add `level:start` to the event list (it should be 2nd line, after `mole:hit`):

```ts
    it('voice.speak is NOT called when voiceEnabled is false', () => {
      settings = { get: () => ({ sfxEnabled: true, bgmEnabled: true, voiceEnabled: false, ambientEnabled: true }) };
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'mole:hit', mole: {} as any, responseMs: 200, tier: 1 });
      bus.emit({ type: 'level:start', levelId: 1 });
      bus.emit({ type: 'mole:miss', holeIndex: 0 });
      bus.emit({ type: 'mole:taunt', mole: {} as any, text: 'x' });
      bus.emit({ type: 'level:complete', stats: {} as any });
      bus.emit({ type: 'level:fail', reason: 'lives_exhausted' });
      bus.emit({ type: 'life:warning', lives: 1 });
      bus.emit({ type: 'level:finale', remainingMs: 5000 });
      expect(voice.speak).not.toHaveBeenCalled();
      d.stop();
    });
```

- [ ] **Step 7: Run all audioDirector tests to verify**

Run: `npm test -- src/audio/audioDirector.test.ts`
Expected: PASS (all tests green; SFX-only tests verify the non-voice paths still fire correctly)

- [ ] **Step 8: Commit**

```bash
git add src/audio/audioDirector.ts src/audio/audioDirector.test.ts
git commit -m "refactor(audio): drop in-game monkey voice chatter (v2 timing)

Remove voice.speak from mole:miss / combo:tier-up / life:warning
subscriptions. SFX and BGM still fire on those events:

- mole:miss         → audio.miss()                (keep)
- combo:tier-up     → audio.tierUp() + setBgmTier (keep)
- life:warning      → audio.setLowLifeMode(true)  (keep)

Monkey now speaks only at 4 ceremonial moments:
  level:start (new greeting) | level:finale | level:complete | level:fail

Re-enable later: revert these 3 lines (data + audio files preserved).

Tests: 4 obsolete voice-trigger tests removed, 3 'no voice + SFX only'
replacements added, 1 voiceEnabled=false test extended with level:start.

Spec: docs/superpowers/specs/2026-06-29-monkey-voice-timing.md
"
```

---

## Task 4: Add `monkeyGreeting` to `speechEngine.test.ts` fake manifest

**Files:**
- Modify: `tests/unit/speechEngine.test.ts:47-56` (fakeManifest)

- [ ] **Step 1: Add `monkeyGreeting` to fake manifest**

In `tests/unit/speechEngine.test.ts`, find the `fakeManifest` object (line 47-56):

```ts
const fakeManifest = {
  lines: {
    monkeyHit: [{ file: '/voice/monkeyHit/0.m4a', text: '太棒啦!' }],
    monkeyMiss: [{ file: '/voice/monkeyMiss/0.m4a', text: '再来一次!' }],
    monkeyWin: [{ file: '/voice/monkeyWin/0.m4a', text: '通关啦!' }],
    monkeyLose: [{ file: '/voice/monkeyLose/0.m4a', text: '再来一局!' }],
    moleHit: [{ file: '/voice/moleHit/0.m4a', text: '哎呦呦!' }],
    moleTaunt: [{ file: '/voice/moleTaunt/0.m4a', text: '打不到我!' }]
  }
};
```

Add `monkeyGreeting` entry after `monkeyLose`:

```ts
const fakeManifest = {
  lines: {
    monkeyHit: [{ file: '/voice/monkeyHit/0.m4a', text: '太棒啦!' }],
    monkeyMiss: [{ file: '/voice/monkeyMiss/0.m4a', text: '再来一次!' }],
    monkeyWin: [{ file: '/voice/monkeyWin/0.m4a', text: '通关啦!' }],
    monkeyLose: [{ file: '/voice/monkeyLose/0.m4a', text: '再来一局!' }],
    monkeyGreeting: [{ file: '/voice/monkeyGreeting/0.m4a', text: '准备好啦?' }],
    moleHit: [{ file: '/voice/moleHit/0.m4a', text: '哎呦呦!' }],
    moleTaunt: [{ file: '/voice/moleTaunt/0.m4a', text: '打不到我!' }]
  }
};
```

- [ ] **Step 2: Run tests to verify pass**

Run: `npm test -- tests/unit/speechEngine.test.ts`
Expected: PASS (existing tests don't iterate ALL_KINDS, but if any test does `prefetchManifest` and then iterates, the new entry is now available)

- [ ] **Step 3: Commit**

```bash
git add tests/unit/speechEngine.test.ts
git commit -m "test(speech): add monkeyGreeting to fake manifest

Mirrors src/speech/voiceLines.ts so any future test that exercises
the full voice-line pool sees the new kind.

Spec: docs/superpowers/specs/2026-06-29-monkey-voice-timing.md
"
```

---

## Task 5: Generate audio files via `generate-voice-pack.mjs`

**Files:**
- Create: `public/voice/monkeyGreeting/0.mp3` ... `4.mp3` (5 files)
- Modify: `public/voice/manifest.json` (auto-updated by script)

- [ ] **Step 1: Run the voice pack generator**

Run: `node --experimental-strip-types scripts/generate-voice-pack.mjs`

Expected: script outputs progress per kind, then writes 5 mp3 files to `public/voice/monkeyGreeting/` and updates `public/voice/manifest.json` with the `monkeyGreeting` entry.

**Requires**: `MATRIX_API_KEY` env var (or whatever the script reads; check `scripts/generate-voice-pack.mjs` for the var name if unsure).

**Failure handling**: If the script fails (rate limit / network / missing key), this task is non-blocking — the implementation is functionally complete (speak() is a silent no-op without files, which matches "voice off" behavior). Log the failure and defer.

- [ ] **Step 2: Verify mp3 files exist**

Run: `ls -la public/voice/monkeyGreeting/`
Expected: 5 files (`0.mp3` ... `4.mp3`), each non-zero size (~10-50KB each, similar to other kinds)

- [ ] **Step 3: Verify manifest.json updated**

Run: `grep -A 6 '"monkeyGreeting"' public/voice/manifest.json`
Expected: 5 entries with `file: "/voice/monkeyGreeting/{0-4}.mp3"` and matching `text` fields

- [ ] **Step 4: Commit (only if files changed)**

```bash
git add public/voice/monkeyGreeting/ public/voice/manifest.json
git commit -m "chore(voice): generate monkeyGreeting audio pack

5 mp3 files in public/voice/monkeyGreeting/ (lines from
src/speech/voiceLines.ts monkeyGreeting pool). manifest.json
updated to reference them.

Generated by: scripts/generate-voice-pack.mjs
Spec: docs/superpowers/specs/2026-06-29-monkey-voice-timing.md
"
```

If files unchanged (script failed/deferred), **skip this commit** and note in final report.

---

## Task 6: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass (existing 39 + 3 new "no voice" + 1 new greeting assertion in level:start test - 4 obsolete removed = net +1 test). Total: ~40 tests green.

- [ ] **Step 2: Run TypeScript build**

Run: `npm run build`
Expected: tsc --noEmit + vite build both green, no type errors. `VoiceLineKind` union extension is source-compatible.

- [ ] **Step 3: Optional manual smoke test**

Run: `npm run dev`
Open http://localhost:5173, start a level, verify:
- On level start: 1 greeting line plays (one of: 准备好啦?/开始吧/来啦/冲一冲/看你的啦)
- During play: no monkey voice on miss / combo / low-life
- In last 10s: monkeyFinale plays
- On level complete/fail: monkeyWin / monkeyLose plays
- Toggle voiceEnabled off in settings: all 4 voice moments go silent, SFX/BGM unaffected

If manual test fails, return to Task 2-3 and verify implementation.

- [ ] **Step 4: Done**

Report: "Monkey voice timing tightened to 4 ceremonial moments. Tests: X pass. Build: clean. Audio files: [generated | deferred]."

---

## Self-Review

**1. Spec coverage:**

| Spec § | Plan task |
|--------|-----------|
| §2.1 新增订阅 (level:start) | Task 2 |
| §2.1 删除订阅 (mole:miss / combo / low-life voice) | Task 3 |
| §2.2 新增 kind + 5 行数据 | Task 1 |
| §2.3 音频文件生成 | Task 5 |
| §3.1 audioDirector.test 14 处 | Task 2 (1 new) + Task 3 (4 delete + 3 new + 1 extend) |
| §3.2 voiceLines.test 1 + 2 扩展 | Task 1 (Steps 1, 6, 7) |
| §3.3 speechEngine.test 1 扩展 | Task 4 |
| §四/§五 风险/范围 | Implicit in plan (no settings toggle, no data deletion) |
| §六 成功标准 | Task 6 |

✅ All spec sections mapped.

**2. Placeholder scan:** No TBD / TODO / "implement later" / "similar to Task N". Every code block is complete.

**3. Type consistency:**
- `VoiceLineKind` union: defined in Task 1, used in Task 4's fake manifest
- `monkeyGreeting` kind name: consistent across `voiceLines.ts`, `audioDirector.ts`, `audioDirector.test.ts`
- Test file path conventions: `tests/unit/voiceLines.test.ts` and `tests/unit/speechEngine.test.ts` (lowercase) vs `src/audio/audioDirector.test.ts` (co-located) — matches existing structure
- `voice.speak()` arg: always string literal `monkeyGreeting` — consistent
