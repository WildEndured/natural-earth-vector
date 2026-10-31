import { Time } from './Time.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.time = new Time();
    this._raf = 0;

    // FPS
    this._fpsFrames = 0;
    this._fpsAccum = 0;
    this.fps = 0;

    this.w = 0;
    this.h = 0;
    this.dpr = 1;

    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('orientationchange', () => {
      // на iOS orientationchange срабатывает ДО resize
      setTimeout(() => this._resize(), 100);
    });
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.dpr = dpr;

    this.canvas.width = Math.floor(this.w * dpr);
    this.canvas.height = Math.floor(this.h * dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';

    // все координаты — в CSS-пикселях
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  start() {
    this.time.start(performance.now());
    this._raf = requestAnimationFrame(this._loop);
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  _loop = (now) => {
    this.time.tick(now);

    // FPS-счётчик (обновляется раз в секунду)
    this._fpsFrames++;
    this._fpsAccum += this.time.delta;
    if (this._fpsAccum >= 1) {
      this.fps = this._fpsFrames / this._fpsAccum;
      this._fpsFrames = 0;
      this._fpsAccum = 0;
    }

    this._update(this.time.delta);
    this._render();

    this._raf = requestAnimationFrame(this._loop);
  };

  _update(dt) {
    // пока пусто
  }

  _render() {
    const { ctx, w, h } = this;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    // FPS
    ctx.fillStyle = '#0f0';
    ctx.font = '14px ui-monospace, monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`FPS: ${this.fps.toFixed(0)}  ${this.w}×${this.h} @${this.dpr}x`, 10, 10);
  }
}
