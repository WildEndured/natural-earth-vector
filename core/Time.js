export class Time {
  constructor() {
    this.elapsed = 0;      // игровое время в секундах
    this.delta = 0;        // dt последнего кадра
    this.lastFrame = 0;    // performance.now() последнего кадра
    this.paused = false;
    this.speed = 1;
  }

  start(nowMs) {
    this.lastFrame = nowMs;
  }

  tick(nowMs) {
    const raw = (nowMs - this.lastFrame) / 1000;
    this.lastFrame = nowMs;

    if (this.paused) {
      this.delta = 0;
      return;
    }

    // clamp: если вкладка свернулась — dt не должен быть 5 сек
    this.delta = Math.min(raw, 0.05) * this.speed;
    this.elapsed += this.delta;
  }
}
