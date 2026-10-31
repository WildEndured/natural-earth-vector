import { rayBlocked } from './RaycastSystem.js';
import { coverMultiplier } from './CoverSystem.js';

const STANCE_ACCURACY = {
  stand: 1.0,
  crouch: 1.15,
  prone: 1.3,
};

const STANCE_HIT_CHANCE = {
  stand: 1.0,
  crouch: 0.8,
  prone: 0.55,
};

export class CombatSystem {
  constructor(ctx) {
    this.ctx = ctx;
  }

  update(dt) {
    for (const u of this.ctx.world.units) {
      if (u.dead) continue;
      if (u.cooldown > 0) u.cooldown -= dt;
      if (u.muzzleFlash > 0) u.muzzleFlash -= dt;

      if (u.isReloading) {
        u.reloadTimer -= dt;
        if (u.reloadTimer <= 0) {
          u.isReloading = false;
          u.ammo = u.weapon.magSize;
        }
        continue;
      }

      if (u.target && !u.target.dead) {
        const d = Math.hypot(u.target.x - u.x, u.target.y - u.y);
        if (d <= u.weapon.range) {
          u.facing = Math.atan2(u.target.y - u.y, u.target.x - u.x);
          if (u.cooldown <= 0 && u.ammo > 0) {
            this.fire(u, u.target);
          } else if (u.ammo <= 0 && !u.isReloading) {
            u.isReloading = true;
            u.reloadTimer = u.weapon.reloadTime;
            this.ctx.bus.emit('unit:reload', { unit: u });
          }
        }
      } else if (u.target && u.target.dead) {
        u.target = null;
      }
    }
  }

  fire(shooter, target) {
    const w = shooter.weapon;
    shooter.ammo--;
    shooter.cooldown = w.fireRate;
    shooter.muzzleFlash = 0.06;

    // Проверка блокировки пули стеной
    const blocker = rayBlocked(shooter.x, shooter.y, target.x, target.y, this.ctx.world.obstacles);

    // Если стена — пуля не долетает
    if (blocker) {
      this.ctx.bus.emit('combat:shot', {
        x: shooter.x,
        y: shooter.y,
        tx: blocker.x,
        ty: blocker.y,
        hit: false,
        blocked: true,
        weaponId: shooter.weaponId,
        team: shooter.team,
      });
      return;
    }

    // Базовый шанс
    const accMult = STANCE_ACCURACY[shooter.stance] || 1.0;
    const targetSizeMult = STANCE_HIT_CHANCE[target.stance] || 1.0;

    // Укрытие цели
    const coverMult = coverMultiplier(target, shooter, this.ctx.world.obstacles);

    let chance = w.accuracy * accMult * targetSizeMult * coverMult;
    chance = Math.max(0.05, Math.min(0.95, chance));

    const hit = this.ctx.rng.chance(chance);

    if (hit) {
      target.hp -= w.damage;
      this.ctx.bus.emit('unit:hit', { unit: target, by: shooter, damage: w.damage });
      if (target.hp <= 0) {
        target.hp = 0;
        target.dead = true;
        target.target = null;
        target.moveTarget = null;
        this.ctx.bus.emit('unit:died', { unit: target, by: shooter });
      }
    }

    this.ctx.bus.emit('combat:shot', {
      x: shooter.x,
      y: shooter.y,
      tx: target.x,
      ty: target.y,
      hit,
      weaponId: shooter.weaponId,
      team: shooter.team,
    });
  }
}
