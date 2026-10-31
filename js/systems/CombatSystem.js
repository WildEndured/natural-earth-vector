import { rayBlocked } from './RaycastSystem.js';
import { coverMultiplier } from './CoverSystem.js';
import { BODY_PARTS } from '../data/anatomy.js';
import { accuracyByDistance, spreadAtDistance } from '../data/weapons.js';

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

      u.health.update(dt);
      if (u.health.dead && !u.dead) {
        u.dead = true;
        u.target = null;
        u.moveTarget = null;
        this.ctx.bus.emit('unit:died', { unit: u, by: null, cause: u.health.deathCause });
        continue;
      }

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

      if (!u.health.canShoot()) continue;

      if (u.target && !u.target.dead) {
        const d = Math.hypot(u.target.x - u.x, u.target.y - u.y);
        if (d <= u.weapon.maxRange) {
          u.facing = Math.atan2(u.target.y - u.y, u.target.x - u.x);
          if (u.cooldown <= 0 && u.ammo > 0) {
            this.fire(u, u.target, false);
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

  // aimed — прицельный выстрел (кнопка)
  fire(shooter, target, aimed = false) {
    const w = shooter.weapon;
    shooter.ammo--;
    shooter.cooldown = w.fireRate * (aimed ? 1.5 : 1.0);
    shooter.muzzleFlash = 0.06;

    const dist = Math.hypot(target.x - shooter.x, target.y - shooter.y);

    // Проверка блокировки
    const blocker = rayBlocked(shooter.x, shooter.y, target.x, target.y, this.ctx.world.obstacles);
    if (blocker) {
      this.ctx.bus.emit('combat:shot', {
        x: shooter.x, y: shooter.y,
        tx: blocker.x, ty: blocker.y,
        hit: false, blocked: true,
        weaponId: shooter.weaponId, team: shooter.team,
      });
      return;
    }

    // ===== ШАНС =====
    const accMult = STANCE_ACCURACY[shooter.stance] || 1.0;
    const targetSizeMult = STANCE_HIT_CHANCE[target.stance] || 1.0;
    const coverMult = coverMultiplier(target, shooter, this.ctx.world.obstacles);
    const healthAcc = shooter.health.accuracyMult();
    const distMult = accuracyByDistance(w, dist);

    let chance = w.accuracy * accMult * targetSizeMult * coverMult * healthAcc * distMult;

    // прицельный — × 0.5 к шансу
    if (aimed && w.aimedShot) chance *= w.aimedShot.accuracyMult;

    chance = Math.max(0.02, Math.min(0.95, chance));

    const hit = this.ctx.rng.chance(chance);

    // ===== РАЗБРОС =====
    // даже при промахе — пуля уходит в случайную точку
    let spread = spreadAtDistance(w, dist);
    if (aimed) spread *= 0.4;

    let bulletX = target.x;
    let bulletY = target.y;
    if (!hit) {
      // промах — пуля в радиусе spread от цели
      const angle = this.ctx.rng.range(0, Math.PI * 2);
      const r = this.ctx.rng.range(spread * 0.3, spread);
      bulletX = target.x + Math.cos(angle) * r;
      bulletY = target.y + Math.sin(angle) * r;
    }

    // ===== УРОН =====
    let hitPart = null;
    let died = false;

    if (hit) {
      // часть тела
      let r = this.ctx.rng.next();
      for (const key in BODY_PARTS) {
        // прицельный — сдвиг к голове
        const weight = (aimed && w.aimedShot && key === w.aimedShot.partBias)
          ? BODY_PARTS[key].hitWeight * 3
          : BODY_PARTS[key].hitWeight;
        r -= weight;
        if (r <= 0) { hitPart = key; break; }
      }
      if (!hitPart) hitPart = 'torso';

      // урон
      let dmg = w.damage;
      if (aimed && w.aimedShot) dmg *= w.aimedShot.damageMult;

      // падение урона на дистанции (10% на 400 м)
      const distFalloff = 1 - (dist / 1000) * 0.1;
      dmg *= Math.max(0.7, distFalloff);

      const result = target.health.takeDamage(dmg, hitPart, () => this.ctx.rng.next());
      died = result.died;

      this.ctx.bus.emit('unit:hit', {
        unit: target, by: shooter,
        damage: dmg, part: hitPart, died,
      });

      if (died && !target.dead) {
        target.dead = true;
        target.target = null;
        target.moveTarget = null;
        this.ctx.bus.emit('unit:died', {
          unit: target, by: shooter,
          cause: target.health.deathCause,
        });
      }
    }

    // ===== СОБЫТИЕ =====
    // Пуля визуально идёт ВСЕГДА (даже промах)
    this.ctx.bus.emit('combat:shot', {
      x: shooter.x, y: shooter.y,
      tx: bulletX, ty: bulletY,
      targetX: target.x, targetY: target.y,
      hit, hitPart, aimed,
      weaponId: shooter.weaponId, team: shooter.team,
      spread,
    });
  }
}
