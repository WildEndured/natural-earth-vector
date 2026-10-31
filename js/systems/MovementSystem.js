const STANCE_SPEED = {
  stand: 1.0,
  crouch: 0.6,
  prone: 0.3,
};

export class MovementSystem {
  constructor(ctx) {
    this.ctx = ctx;
  }

  update(dt) {
    for (const u of this.ctx.world.units) {
      if (u.dead || !u.moveTarget) continue;
      const dx = u.moveTarget.x - u.x;
      const dy = u.moveTarget.y - u.y;
      const d = Math.hypot(dx, dy);

      if (d < 2) {
        u.moveTarget = null;
        u.state = 'idle';
        continue;
      }

      const stance = u.stance || 'stand';
      const stanceMult = STANCE_SPEED[stance] || 1.0;
      const speed = 80 * stanceMult;
      const step = Math.min(d, speed * dt);
      u.x += (dx / d) * step;
      u.y += (dy / d) * step;
      u.facing = Math.atan2(dy, dx);
      u.state = 'moving';
    }
  }
}
