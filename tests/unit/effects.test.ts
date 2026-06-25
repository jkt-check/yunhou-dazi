import { describe, it, expect } from 'vitest';
import { ParticleSystem } from '@/render/effects';

describe('ParticleSystem', () => {
  it('starts with empty particles', () => {
    const ps = new ParticleSystem();
    expect(ps.particles).toHaveLength(0);
  });

  it('burst() adds particles based on tier', () => {
    const ps = new ParticleSystem();
    ps.burst(100, 100, 1, '#000');
    expect(ps.particles).toHaveLength(6);

    ps.burst(200, 100, 4, '#000');
    expect(ps.particles.length).toBeGreaterThanOrEqual(28);
  });

  it('tick() advances particles and removes dead ones', () => {
    const ps = new ParticleSystem();
    ps.burst(100, 100, 1, '#000');
    const initialCount = ps.particles.length;

    // Tick past maxLife
    ps.tick(1000);
    expect(ps.particles).toHaveLength(0);
    expect(initialCount).toBeGreaterThan(0);
  });

  it('tick() applies gravity and velocity', () => {
    const ps = new ParticleSystem();
    ps.burst(100, 100, 1, '#000');
    const startY = ps.particles[0].y;
    const startVy = ps.particles[0].vy;

    ps.tick(100);  // 100ms

    const p = ps.particles[0];
    expect(p.x).not.toBe(100);  // moved
    expect(p.y).toBeGreaterThan(startY);  // gravity pulls down
    expect(p.vy).toBeGreaterThan(startVy);  // vy increased
  });

  it('floatText() adds a floating text element', () => {
    const ps = new ParticleSystem();
    ps.floatText('+10', 100, 100, '#000');
    expect(ps.floatingTexts).toHaveLength(1);
    expect(ps.floatingTexts[0].text).toBe('+10');
  });

  it('clear() removes all particles and texts', () => {
    const ps = new ParticleSystem();
    ps.burst(100, 100, 1, '#000');
    ps.floatText('+10', 100, 100, '#000');
    ps.clear();
    expect(ps.particles).toHaveLength(0);
    expect(ps.floatingTexts).toHaveLength(0);
  });
});
