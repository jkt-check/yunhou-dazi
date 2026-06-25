export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface FloatingText {
  text: string;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

const BURST_COUNTS = [0, 6, 12, 18, 28];

export class ParticleSystem {
  particles: Particle[] = [];
  floatingTexts: FloatingText[] = [];

  burst(x: number, y: number, tier: 1 | 2 | 3 | 4, color: string): void {
    const count = BURST_COUNTS[tier];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 80 + tier * 30 + Math.random() * 40;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - tier * 10,
        life: 0,
        maxLife: 300 + tier * 100,
        size: 2 + tier * 0.5,
        color
      });
    }
  }

  floatText(text: string, x: number, y: number, color: string): void {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -50,
      life: 0,
      maxLife: 1000,
      color
    });
  }

  tick(dt: number): void {
    for (const p of this.particles) {
      p.x += (p.vx * dt) / 1000;
      p.y += (p.vy * dt) / 1000;
      p.vy += (200 * dt) / 1000;
      p.life += dt;
    }
    this.particles = this.particles.filter(p => p.life < p.maxLife);

    for (const ft of this.floatingTexts) {
      ft.y += (ft.vy * dt) / 1000;
      ft.life += dt;
    }
    this.floatingTexts = this.floatingTexts.filter(ft => ft.life < ft.maxLife);
  }

  clear(): void {
    this.particles = [];
    this.floatingTexts = [];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = 1 - p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const ft of this.floatingTexts) {
      const alpha = 1 - ft.life / ft.maxLife;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
  }
}
