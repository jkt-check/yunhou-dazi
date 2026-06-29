import { describe, it, expect } from 'vitest';
import { MonkeyAnimations } from '@/render/monkeyAnimations';

describe('MonkeyAnimations', () => {
  it('starts in idle state', () => {
    const m = new MonkeyAnimations();
    expect(m.getCurrentState()).toBe('idle');
  });

  it('setState changes state', () => {
    const m = new MonkeyAnimations();
    m.setState('hit');
    expect(m.getCurrentState()).toBe('hit');
  });

  it('getStateAge returns time since last state change', () => {
    let t = 0;
    const m = new MonkeyAnimations(() => t);
    m.setState('hit');
    t = 100;
    expect(m.getStateAge()).toBeGreaterThanOrEqual(100);
  });

  it('extendTaunt switches to taunt state', () => {
    let t = 0;
    const m = new MonkeyAnimations(() => t);
    m.extendTaunt(t + 500);
    expect(m.getCurrentState()).toBe('taunt');
  });

  it('extendTaunt aligns auto-transition to fire at `until` (regression: was future-stateStartedAt)', () => {
    let t = 1000;
    const m = new MonkeyAnimations(() => t);
    m.extendTaunt(t + 1500);  // taunt should end at t=2500
    // Before until: stays in taunt
    t = 2400;
    m.tick();
    expect(m.getCurrentState()).toBe('taunt');
    // At/after until: auto-transitions to idle
    t = 2500;
    m.tick();
    expect(m.getCurrentState()).toBe('idle');
  });

  it('returns to idle after transient state duration elapses via tick()', () => {
    let t = 0;
    const m = new MonkeyAnimations(() => t);
    m.setState('hit');
    t = 0;
    m.tick();  // hit duration = 300ms; at age=0 we're not yet past
    expect(m.getCurrentState()).toBe('hit');
    t = 400;
    m.tick();  // now at age=400, > 300, should auto-transition
    expect(m.getCurrentState()).toBe('idle');
  });
});
