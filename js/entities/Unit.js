import { WEAPONS } from '../data/weapons.js';
import { Health } from './Health.js';

export class Unit {
  constructor({ id, x, y, team, role, weaponId, squadId = null }) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.team = team;
    this.role = role;
    this.weaponId = weaponId;
    this.squadId = squadId;
    this.squad = null;

    this.radius = 0.4;
    this.facing = 0;
    this.health = new Health();
    this.dead = false;

    this.state = 'idle';
    this.moveTarget = null;
    this.formationSlot = null;

    this.stance = 'stand';
    this.desiredStance = 'stand';
    this.stanceTimer = 0;

    this.target = null;
    this.cooldown = 0;
    this.ammo = 30;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.muzzleFlash = 0;
  }

  get weapon() {
    return WEAPONS[this.weaponId];
  }

  // для обратной совместимости — hp/maxHp через health
  get hp() {
    return this.health.totalHp().current;
  }

  get maxHp() {
    return this.health.totalHp().max;
  }

  // "Живой" — не мёртв и может стрелять (не потерял обе руки)
  get alive() {
    return !this.dead && !this.health.dead;
  }
}
