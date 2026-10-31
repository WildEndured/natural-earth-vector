const VIEW_RANGE = 300;

export class UnitAI {
  constructor(ctx) {
    this.ctx = ctx;
    this._searchTimer = 0;
    this._searchRate = 0.3;
  }

  update(dt) {
    this._searchTimer += dt;
    const doSearch = this._searchTimer >= this._searchRate;
    if (doSearch) this._searchTimer = 0;

    const skipTeam = this.ctx.playerTeam;

    for (const u of this.ctx.world.units) {
      if (u.dead) continue;
      if (u.team === skipTeam) continue; // управляется игроком

      if (doSearch) {
        const enemy = this._findNearestEnemy(u);
        if (enemy) u.target = enemy;
        else u.target = null;
      }

      if (u.target && u.target.dead) u.target = null;
    }
  }

  _findNearestEnemy(u) {
    let best = null;
    let bestDist = VIEW_RANGE;
    for (const other of this.ctx.world.units) {
      if (other.dead || other.team === u.team) continue;
      const d = Math.hypot(other.x - u.x, other.y - u.y);
      if (d < bestDist) {
        bestDist = d;
        best = other;
      }
    }
    return best;
  }
}
