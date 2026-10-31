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

    for (const squad of this.ctx.world.squads) {
      if (squad.team === 'RU') continue;
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
    // "в радиусе" — 80% от радиуса, чтобы не толпились на краю
    const anyInRadius = alive.some(u => Math.hypot(u.x - obj.x, u.y - obj.y) < obj.radius * 0.8);

    if (!anyInRadius) {
      if (!squad._movingToObjective) {
        squad._movingToObjective = true;
        this._sendFormationToObjective(squad);
      }
    } else {
      squad._movingToObjective = false;
    }
  }

  _sendFormationToObjective(squad) {
    const obj = this.ctx.world.objective;
    const alive = squad.aliveUnits;
    // кольцо радиусом 15 м — 5 юнитов не толпятся
    const ringRadius = 15;
    for (let i = 0; i < alive.length; i++) {
      const u = alive[i];
      const angle = (i / alive.length) * Math.PI * 2;
      u.moveTarget = {
        x: obj.x + Math.cos(angle) * ringRadius,
        y: obj.y + Math.sin(angle) * ringRadius,
      };
    }
  }
}
