export class SelectionSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this._lastTapTime = 0;
    this._lastTapUnit = null;
  }

  findUnitAt(worldX, worldY) {
    const tapRadius = 20;
    const team = this.ctx.playerTeam;
    let best = null;
    let bestDist = Infinity;
    for (const u of this.ctx.world.units) {
      if (u.dead || u.team !== team) continue;
      const d = Math.hypot(u.x - worldX, u.y - worldY);
      if (d < u.radius + tapRadius && d < bestDist) {
        best = u;
        bestDist = d;
      }
    }
    return best;
  }

  selectAt(worldX, worldY) {
    const unit = this.findUnitAt(worldX, worldY);
    const now = performance.now();

    if (unit && this._lastTapUnit === unit && now - this._lastTapTime < 300) {
      this.selectSquad(unit.squad);
      this._lastTapUnit = null;
    } else {
      this.ctx.world.selectedUnits = unit ? [unit] : [];
      this._lastTapUnit = unit;
      this.ctx.bus.emit('selection:changed', {
        units: this.ctx.world.selectedUnits,
      });
    }
    this._lastTapTime = now;
  }

  selectSquad(squad) {
    if (!squad) return;
    if (squad.team !== this.ctx.playerTeam) return;
    this.ctx.world.selectedUnits = squad.aliveUnits;
    this.ctx.bus.emit('selection:changed', {
      units: this.ctx.world.selectedUnits,
    });
  }

  selectAllPlayerUnits() {
    const team = this.ctx.playerTeam;
    const units = this.ctx.world.units.filter(u => !u.dead && u.team === team);
    this.ctx.world.selectedUnits = units;
    this.ctx.bus.emit('selection:changed', { units });
  }

  clearSelection() {
    this.ctx.world.selectedUnits = [];
    this.ctx.bus.emit('selection:changed', { units: [] });
  }
}
