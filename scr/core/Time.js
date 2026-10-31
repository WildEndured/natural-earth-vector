export class Time {
  constructor() {
    this.elapsed = 0;
    this.delta = 0;
    this.lastFrame = 0;
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

    this.delta = Math.min(raw, 0.05) * this.speed;
    this.elapsed += this.delta;
  }
}
