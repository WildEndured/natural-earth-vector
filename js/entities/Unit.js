import { WEAPONS } from '../data/weapons.js';

export class Unit {
  constructor({ id, x, y, team, role, weaponId, squadId = null }) {
    this.id = id;
    this.x = x;               // метры
    this.y = y;               // метры
    this.team = team;
    this.role = role;
    this.weaponId = weaponId;
    this.squadId = squadId;
    this.squad = null;

    this.radius = 0.4;        // м — человек ~80 см в ширину
    this.facing = 0;
    this.hp = 100;
    this.maxHp = 100;
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
}
