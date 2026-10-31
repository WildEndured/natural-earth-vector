import { Camera } from './Camera.js';
import { RNG } from './RNG.js';
import { EventBus } from './EventBus.js';

export class Game {
  constructor({ canvas }) {
    this.canvas = canvas;
    this.ctx2d = canvas.getContext('2d', { alpha: false });
    this.dpr = 1;
    this.w = 0; this.h = 0;
    this.time = 0;
    this.paused = false;
    this.running = false;

    this.camera = new Camera();
    this.rng = new RNG(42);           // seed → детерминизм
    this.bus = new EventBus();

    this._last = 0;
    this._raf = 0;

    this._onResize = this._onResize.bind(this);
    this._loop = this._loop.bind(this);
    window.addEventListener('resize', this._onResize);
    this._onResize();
  }

  _onResize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * dpr);
    this.canvas.height = Math.floor(this.h * dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }

  _loop(now) {
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    if (!this.paused) this.update(dt);
    this.render();
    this._raf = requestAnimationFrame(this._loop);
  }

  update(dt) {
    this.time += dt;
    // системы добавятся позже
  }

  render() {
    this.ctx2d.fillStyle = '#2d3a2e';
    this.ctx2d.fillRect(0, 0, this.w, this.h);
    // рендер мира добавится позже
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    this.bus.clear();
  }
}
