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
      if (squad.team === 'RU') continue; // РФ управляется игроком
      this._updateSquad(squad);
    }
  }

  _updateSquad(squad) {
    const alive = squad.aliveUnits;
    if (alive.length === 0) return;

    // лидер мёртв — назначить нового
    if (!squad.leader || squad.leader.dead) {
      squad.leader = alive[0];
    }

    // цель — точка
    const obj = this.ctx.world.objective;
    const anyInRadius = alive.some(u => Math.hypot(u.x - obj.x, u.y - obj.y) < obj.radius * 0.8);

    if (!anyInRadius) {
      // идём к точке, если ещё не идём
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
    for (let i = 0; i < alive.length; i++) {
      const u = alive[i];
      const angle = (i / alive.length) * Math.PI * 2;
      const r = obj.radius * 0.6;
      u.moveTarget = {
        x: obj.x + Math.cos(angle) * r,
        y: obj.y + Math.sin(angle) * r,
      };
    }
  }
}
