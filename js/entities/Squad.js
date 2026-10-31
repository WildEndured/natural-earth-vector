export class Squad {
  constructor({ id, team, name }) {
    this.id = id;
    this.team = team;
    this.name = name;
    this.units = [];
    this.leader = null;
    this.order = 'idle';        // 'idle' | 'move' | 'attack' | 'hold' | 'follow'
    this.orderTarget = null;    // { x, y } или null
    this.orderTime = 0;         // когда отдан — для задержки радио
  }

  addUnit(unit) {
    unit.squad = this;
    this.units.push(unit);
    // лидер — командир или первый
    if (!this.leader || unit.role === 'commander') {
      this.leader = unit;
    }
  }

  get aliveUnits() {
    return this.units.filter(u => !u.dead);
  }

  get aliveCount() {
    return this.units.reduce((n, u) => n + (u.dead ? 0 : 1), 0);
  }

  get isWiped() {
    return this.aliveCount === 0;
  }

  setOrder(order, target = null) {
    this.order = order;
    this.orderTarget = target;
    this.orderTime = performance.now(); // TODO: заменить на game.time позже
  }
}
