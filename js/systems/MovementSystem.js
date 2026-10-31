import { pointInBlockingObstacle } from './RaycastSystem.js';

const STANCE_SPEED = {
  stand: 1.0,
  crouch: 0.6,
  prone: 0.25,
};

const BASE_SPEED = 1.4;

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

      if (d < 1) {
        u.moveTarget = null;
        u.state = 'idle';
        continue;
      }

      const stance = u.stance || 'stand';
      const stanceMult = STANCE_SPEED[stance] || 1.0;
      const speed = BASE_SPEED * stanceMult;
      const step = Math.min(d, speed * dt);

      const angle = Math.atan2(dy, dx);
      const moved = this._tryMove(u, angle, step);

      if (moved) {
        u.facing = angle;
        u.state = 'moving';
      } else {
        // попробовать обход
        const detour = this._findDetour(u, angle, step);
        if (detour !== null) {
          u.facing = detour;
          u.state = 'moving';
        } else {
          u.state = 'blocked';
        }
      }
    }
  }

  _tryMove(u, angle, step) {
    const nx = u.x + Math.cos(angle) * step;
    const ny = u.y + Math.sin(angle) * step;
    // границы
    if (nx < 1 || nx > this.ctx.world.width - 1 || ny < 1 || ny > this.ctx.world.height - 1) return false;
    // стены
    const blocker = pointInBlockingObstacle(nx, ny, this.ctx.world.obstacles);
    if (blocker) return false;
    u.x = nx;
    u.y = ny;
    return true;
  }

  _findDetour(u, baseAngle, step) {
    // пробуем углы отклонения: ±30°, ±60°, ±90°
    const offsets = [Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2];
    for (const off of offsets) {
      const angle = baseAngle + off;
      if (this._tryMove(u, angle, step)) return angle;
    }
    return null;
  }
}
