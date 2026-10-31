export class VictorySystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.holdToWin = 30;   // сек удержания точки для победы
    this._ruHoldStart = null;
    this._usHoldStart = null;
    this._ended = false;
  }

  update(dt) {
    if (this._ended) return;

    const ru = this.ctx.world.getSquad('RU');
    const us = this.ctx.world.getSquad('US');
    const o = this.ctx.world.objective;

    if (ru && ru.isWiped) return this._end('US');
    if (us && us.isWiped) return this._end('RU');

    const now = this.ctx.time;
    if (o.owner === 'RU') {
      if (this._ruHoldStart === null) this._ruHoldStart = now;
      if (now - this._ruHoldStart >= this.holdToWin) return this._end('RU');
    } else {
      this._ruHoldStart = null;
    }

    if (o.owner === 'US') {
      if (this._usHoldStart === null) this._usHoldStart = now;
      if (now - this._usHoldStart >= this.holdToWin) return this._end('US');
    } else {
      this._usHoldStart = null;
    }
  }

  _end(winner) {
    if (this._ended) return;
    this._ended = true;
    this.ctx.bus.emit('game:over', { winner });
  }

  reset() {
    this._ended = false;
    this._ruHoldStart = null;
    this._usHoldStart = null;
  }
}
