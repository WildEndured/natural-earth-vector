import { Camera } from './Camera.js';
import { RNG } from './RNG.js';
import { EventBus } from './EventBus.js';
import { World } from '../world/World.js';
import { Renderer } from '../render/Renderer.js';

export class Game {
  constructor({ canvas }) {
    this.canvas = canvas;
    this.ctx2d = canvas.getContext('2d', { alpha: false });
    this.w = 0;
    this.h = 0;
    this.time = 0;
    this.paused = false;
    this.gameOver = false;
    this.running = false;

    this.camera = new Camera({ x: 500, y: 500, zoom: 0.8 });
    this.rng = new RNG(42);
    this.bus = new EventBus();
    this.world = new World({ width: 1000, height: 1000 });
    this.systems = [];
    this.minimap = null;

    this.ctx = {
      game: this,
      camera: this.camera,
      rng: this.rng,
      bus: this.bus,
      world: this.world,
      time: 0,
      get w() { return this.game.w; },
      get h() { return this.game.h; },
    };

    this.renderer = new Renderer(canvas, this.ctx);

    this._last = 0;
    this._raf = 0;
    this._onResize = this._onResize.bind(this);
    this._loop = this._loop.bind(this);
    window.addEventListener('resize', this._onResize);
    this._onResize();
  }

  setMinimap(minimap) {
    this.minimap = minimap;
  }

  registerSystems(...systems) {
    for (const s of systems) this.systems.push(s);
  }

  _onResize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
    if (!this.paused && !this.gameOver) this.update(dt);
    this.render();
    this._raf = requestAnimationFrame(this._loop);
  }

  update(dt) {
    this.time += dt;
    this.ctx.time = this.time;
    for (const s of this.systems) s.update(dt);
  }

  render() {
    this.renderer.render();
    if (this.minimap) this.minimap.render();
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    this.bus.clear();
  }
}
