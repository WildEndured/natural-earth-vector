export class Squad {
  constructor({ id, team, name }) {
    this.id = id;
    this.team = team;
    this.name = name;
    this.units = [];
    this.leader = null;
    this.order = 'idle';
    this.orderTarget = null;
  }

  addUnit(unit) {
    unit.squad = this;
    this.units.push(unit);
    if (!this.leader || unit.role === 'commander' || unit.role === 'squad_leader') {
      this.leader = unit;
    }
  }

  get aliveUnits() {
    return this.units.filter(u => !u.dead);
  }

  get aliveCount() {
    let n = 0;
    for (const u of this.units) if (!u.dead) n++;
    return n;
  }

  get isWiped() {
    return this.aliveCount === 0;
  }

  setOrder(order, target = null) {
    this.order = order;
    this.orderTarget = target;
  }
}
