import { Health } from './Health.js';
import { WEAPONS } from '../data/weapons.js';

let NEXT_ID = 1;

export class Unit {
  constructor(cfg) {
    this.id = NEXT_ID++;
    this.team = cfg.team;
    this.role = cfg.role || 'rifleman';
    this.roleName = cfg.roleName || 'Стрелок';

    this.x = cfg.x;
    this.y = cfg.y;
    this.facing = 0;
    this.radius = 6;

    this.health = new Health(cfg.rng);
    this.weaponId = cfg.weaponId;
    this.weapon = WEAPONS[cfg.weaponId];
    this.ammo = this.weapon.magSize;
    this.cooldown = 0;

    this.target = null;
    this.moveTarget = null;
    this.stance = 'stand';
    this.state = 'idle';
    this.dead = false;
  }

  get alive() {
    return !this.dead && !this.health.dead;
  }
}
