import { Camera } from './Camera.js';
import { RNG } from './RNG.js';
import { EventBus } from './EventBus.js';
import { World } from '../world/World.js';
import { Renderer } from '../render/Renderer.js';
import { getMap } from '../data/maps.js';
import { TimeSystem } from '../systems/TimeSystem.js';

export class Game {
  constructor({ canvas, mapId = 'open', playerTeam = 'RU' }) {
    this.canvas = canvas;
    this.ctx2d = canvas.getContext('2d', { alpha: false });
    this.w = 0;
    this.h = 0;
    this.time = 0;
    this.gameOver = false;
    this.running = false;

    this.mapId = mapId;
    this.playerTeam = playerTeam;
    const map = getMap(mapId);

    this.camera = new Camera({
      x: map.cameraStart.x,
      y: map.cameraStart.y,
      zoom: map.cameraStart.zoom,
      minZoom: map.minZoom,
      maxZoom: map.maxZoom,
    });

    this.rng = new RNG(42);
    this.bus = new EventBus();
    this.world = new World({ mapId, playerTeam });
    this.systems = [];
    this.minimap = null;

    this.time_system = new TimeSystem(null);

    this.ctx = {
      game: this,
      camera: this.camera,
      rng: this.rng,
      bus: this.bus,
      world: this.world,
      time: 0,
      timeSystem: this.time_system,
      playerTeam: playerTeam,
      get w() { return this.game.w; },
      get h() { return this.game.h; },
    };
    this.time_system.ctx = this.ctx;

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
    const realDt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;

    const simDt = realDt * this.time_system.dtMultiplier;

    if (!this.gameOver && simDt > 0) {
      this.update(simDt);
    }
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
