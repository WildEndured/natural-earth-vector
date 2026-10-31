import { Squad } from '../entities/Squad.js';
import { Unit } from '../entities/Unit.js';
import { getMap } from '../data/maps.js';

export class World {
  constructor({ mapId = 'standard' }) {
    this.mapId = mapId;
    this.map = getMap(mapId);
    this.width = this.map.width;
    this.height = this.map.height;
    this.reset();
  }

  reset() {
    this.units = [];
    this.squads = [];
    this.selectedUnits = [];
    this._nextUnitId = 1;
    this._nextSquadId = 1;

    this.objective = {
      x: this.width / 2,
      y: this.height / 2,
      radius: this.map.objective.radius,
      owner: 'neutral',
      holdTime: 0,
    };
  }

  getSpawn(team) {
    return this.map.spawn[team];
  }

  createSquad({ team, name }) {
    const squad = new Squad({ id: this._nextSquadId++, team, name });
    this.squads.push(squad);
    return squad;
  }

  createUnit({ x, y, team, role, weaponId, squad = null }) {
    const unit = new Unit({
      id: this._nextUnitId++,
      x, y, team, role, weaponId,
      squadId: squad ? squad.id : null,
    });
    this.units.push(unit);
    if (squad) squad.addUnit(unit);
    return unit;
  }

  getSquad(team) {
    return this.squads.find(s => s.team === team);
  }
}
