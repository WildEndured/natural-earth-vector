export class MovementSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.baseSpeed = 80; // пикселей в секунду
  }

  update(dt) {
    const units = this.ctx.world.units;

    // 1. Движение
    for (const u of units) {
      if (!u.alive || !u.moveTarget) continue;
      if (u.cooldown > 0) u.cooldown -= dt;

      const dx = u.moveTarget.x - u.x;
      const dy = u.moveTarget.y - u.y;
      const d = Math.hypot(dx, dy);

      if (d < 3) {
        u.moveTarget = null;
        u.state = 'idle';
        continue;
      }

      const speed = this.baseSpeed * u.health.speedMult();
      const step = Math.min(d, speed * dt);
      u.x += (dx / d) * step;
      u.y += (dy / d) * step;
      u.facing = Math.atan2(dy, dx);
      u.state = 'moving';
    }

    // 2. Разрешение налезаний
    this._resolveCollisions(units);

    // 3. Обновление здоровья (кровотечение)
    for (const u of units) {
      if (u.alive) u.health.update(dt);
    }
  }

  _resolveCollisions(units) {
    for (let i = 0; i < units.length; i++) {
      const a = units[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < units.length; j++) {
        const b = units[j];
        if (!b.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dSq = dx * dx + dy * dy;
        const minD = a.radius + b.radius;
        if (dSq < minD * minD && dSq > 0.001) {
          const d = Math.sqrt(dSq);
          const overlap = (minD - d) * 0.5;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
        }
      }
    }
  }
            }
