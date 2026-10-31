import { dist, distSq } from '../util/geometry.js';

export class CombatSystem {
  constructor(ctx) { this.ctx = ctx; }
  tryFire(shooter, target) {
    if (!shooter || !target || shooter.dead || target.dead) return null;
    if (shooter.team === target.team) return null;
    const w = WEAPONS[shooter.weaponId];
    if (!w) return null;
    if (distSq(shooter, target) > w.range * w.range) return null;
    // поворот
    shooter.facing = Math.atan2(target.y - shooter.y, target.x - shooter.x);
    // шанс
    const hit = this.ctx.rng.chance(w.accuracy);
    const shot = { x: shooter.x, y: shooter.y, tx: target.x, ty: target.y, hit, weaponId: shooter.weaponId };
    if (hit) {
      target.hp -= w.damage;
      if (target.hp <= 0) target.dead = true;
    }
    this.ctx.bus.emit('combat:shot', shot);
    return shot;
  }
}
