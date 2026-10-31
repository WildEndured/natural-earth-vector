import { Squad } from '../entities/Squad.js';
import { Unit } from '../entities/Unit.js';

export class World {
  constructor({ width, height }) {
    this.width = width;
    this.height = height;
    this.units = [];
    this.squads = [];
    this.selectedUnits = [];
    this._nextUnitId = 1;
    this._nextSquadId = 1;

    this.objective = {
      x: width / 2,
      y: height / 2,
      radius: 100,
      owner: 'neutral',
    };
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
