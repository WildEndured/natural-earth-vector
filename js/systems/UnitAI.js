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

    for (const u of this.ctx.world.units) {
      if (u.dead) continue;
      // Игрок управляет RU-юнитами — не вмешиваемся, если у них есть приказ
      if (u.team === 'RU' && (u.moveTarget || u.target)) continue;
      // Иначе — ИИ управляет

      if (doSearch) {
        const enemy = this._findNearestEnemy(u);
        if (enemy) {
          u.target = enemy;
        } else if (!u.moveTarget && u.state !== 'hold') {
          u.target = null;
        }
      }

      // если цель мертва — сбросить
      if (u.target && u.target.dead) u.target = null;
    }
  }

  _findNearestEnemy(u) {
    const viewRange = 300;
    let best = null;
    let bestDist = viewRange;
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
