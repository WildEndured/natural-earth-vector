export class TimeSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.scale = 1;         // 0 = пауза, 1, 2, 4, 8
    this.paused = false;
    this._lastScale = 1;    // для кнопки "пауза" → вернуть прошлую скорость
  }

  setScale(scale) {
    if (scale === 0) {
      this.paused = true;
      this.scale = 0;
    } else {
      this._lastScale = scale;
      this.paused = false;
      this.scale = scale;
    }
    this.ctx.bus.emit('time:changed', { scale: this.scale, paused: this.paused });
  }

  togglePause() {
    if (this.paused) this.setScale(this._lastScale);
    else this.setScale(0);
  }

  get dtMultiplier() {
    return this.paused ? 0 : this.scale;
  }
}
