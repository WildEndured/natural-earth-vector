export class StanceSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this._switchTime = 0.5; // сек на смену стойки
  }

  update(dt) {
    for (const u of this.ctx.world.units) {
      if (u.dead) continue;
      if (!u.desiredStance) u.desiredStance = 'stand';
      if (u.desiredStance !== u.stance) {
        u.stanceTimer = (u.stanceTimer || 0) + dt;
        if (u.stanceTimer >= this._switchTime) {
          u.stance = u.desiredStance;
          u.stanceTimer = 0;
        }
      } else {
        u.stanceTimer = 0;
      }
    }
  }
}
