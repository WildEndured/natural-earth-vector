// Скорости в метрах в секунду — реальные для пехоты
const STANCE_SPEED = {
  stand: 1.4,      // шаг
  run: 3.5,        // бег
  crouch: 0.9,     // с колена
  prone: 0.3,      // ползком
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

      if (d < 0.5) {
        u.moveTarget = null;
        u.state = 'idle';
        continue;
      }

      // автоматически — бег, если далеко от цели и не в бою
      const stance = this._chooseStance(u, d);
      const speed = STANCE_SPEED[stance] || STANCE_SPEED.stand;
      const step = Math.min(d, speed * dt);

      u.x += (dx / d) * step;
      u.y += (dy / d) * step;
      u.facing = Math.atan2(dy, dx);
      u.state = 'moving';
      u.stance = stance;
    }
  }

  _chooseStance(u, distanceToTarget) {
    // если есть враг в радиусе — не бежим, а осторожно идём
    const enemyNear = this._hasEnemyNear(u, 100);
    if (enemyNear) {
      return u.stance === 'prone' ? 'prone' : 'stand';
    }
    // далеко от цели — бежим
    if (distanceToTarget > 30) return 'run';
    // близко — идём шагом
    return 'stand';
  }

  _hasEnemyNear(u, radius) {
    for (const other of this.ctx.world.units) {
      if (other.dead || other.team === u.team) continue;
      const d = Math.hypot(other.x - u.x, other.y - u.y);
      if (d < radius) return true;
    }
    return false;
  }
}
