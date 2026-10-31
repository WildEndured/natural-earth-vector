import { dist } from '../util/geometry.js';

export class MovementSystem {
  constructor(ctx) { this.ctx = ctx; }
  update(dt) {
    for (const u of this.ctx.world.units) {
      if (u.dead || !u.moveTarget) continue;
      const dx = u.moveTarget.x - u.x;
      const dy = u.moveTarget.y - u.y;
      const d = Math.hypot(dx, dy);
      if (d < 2) { u.moveTarget = null; continue; }
      const speed = 80; // px/sec
      const step = Math.min(d, speed * dt);
      u.x += (dx / d) * step;
      u.y += (dy / d) * step;
      u.facing = Math.atan2(dy, dx);
    }
  }
}
