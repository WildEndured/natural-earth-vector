// Скорость пехоты 1.4 м/с (нормальный шаг), стойки множат
const STANCE_SPEED = {
  stand: 1.0,    // 1.4 м/с
  crouch: 0.6,   // 0.84 м/с
  prone: 0.25,   // 0.35 м/с
};

const BASE_SPEED = 1.4; // м/с

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

      // порог "дошёл" = 1 м
      if (d < 1) {
        u.moveTarget = null;
        u.state = 'idle';
        continue;
      }

      const stance = u.stance || 'stand';
      const stanceMult = STANCE_SPEED[stance] || 1.0;
      const speed = BASE_SPEED * stanceMult;
      const step = Math.min(d, speed * dt);
      u.x += (dx / d) * step;
      u.y += (dy / d) * step;
      u.facing = Math.atan2(dy, dx);
      u.state = 'moving';
    }
  }
}
