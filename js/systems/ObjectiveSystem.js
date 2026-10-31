export class ObjectiveSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.captureTime = 5.0; // сек на захват
  }

  update(dt) {
    const o = this.ctx.world.objective;
    let ruCount = 0;
    let usCount = 0;

    for (const u of this.ctx.world.units) {
      if (u.dead) continue;
      const d = Math.hypot(u.x - o.x, u.y - o.y);
      if (d > o.radius) continue;
      if (u.team === 'RU') ruCount++;
      else if (u.team === 'US') usCount++;
    }

    if (ruCount > 0 && usCount === 0) {
      if (o.owner !== 'RU') {
        o.holdTime += dt;
        if (o.holdTime >= this.captureTime) {
          o.owner = 'RU';
          o.holdTime = 0;
          this.ctx.bus.emit('objective:captured', { team: 'RU' });
        }
      } else {
        o.holdTime = 0;
      }
    } else if (usCount > 0 && ruCount === 0) {
      if (o.owner !== 'US') {
        o.holdTime += dt;
        if (o.holdTime >= this.captureTime) {
          o.owner = 'US';
          o.holdTime = 0;
          this.ctx.bus.emit('objective:captured', { team: 'US' });
        }
      } else {
        o.holdTime = 0;
      }
    } else {
      o.holdTime = Math.max(0, o.holdTime - dt * 2);
    }
  }
}
