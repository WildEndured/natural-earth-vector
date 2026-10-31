import { Map } from './Map.js';
import { Unit } from '../entities/Unit.js';

export class World {
  constructor(mapId, rng) {
    this.rng = rng;
    this.map = new Map(mapId);
    this.width = this.map.width;
    this.height = this.map.height;
    this.objective = this.map.objective;

    this.units = [];
    this.projectiles = [];
    this.effects = [];
  }

  spawnUnit(cfg) {
    const u = new Unit({ ...cfg, rng: this.rng });
    this.units.push(u);
    return u;
  }

  aliveUnits() {
    return this.units.filter((u) => u.alive);
  }
}
