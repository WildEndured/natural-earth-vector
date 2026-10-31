import { applyFormationOrder } from '../util/formation.js';

export class SquadAI {
  constructor(ctx) {
    this.ctx = ctx;
    this._tickTimer = 0;
    this._tickRate = 0.5;
  }

  update(dt) {
    this._tickTimer += dt;
    if (this._tickTimer < this._tickRate) return;
    this._tickTimer = 0;

    const skipTeam = this.ctx.playerTeam;
    for (const squad of this.ctx.world.squads) {
      if (squad.team === skipTeam) continue;
      this._updateSquad(squad);
    }
  }

  _updateSquad(squad) {
    const alive = squad.aliveUnits;
    if (alive.length === 0) return;

    if (!squad.leader || squad.leader.dead) {
      squad.leader = alive[0];
    }

    const obj = this.ctx.world.objective;
    const anyInRadius = alive.some(u => Math.hypot(u.x - obj.x, u.y - obj.y) < obj.radius * 0.8);

    if (!anyInRadius) {
      if (!squad._movingToObjective) {
        squad._movingToObjective = true;
        if (!squad.formation) squad.formation = 'line';
        applyFormationOrder(squad, { x: obj.x, y: obj.y }, squad.formation);
      }
    } else {
      squad._movingToObjective = false;
    }
  }
}
