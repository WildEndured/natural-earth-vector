import { Time } from './Time.js';
import { Camera } from './Camera.js';
import { EventBus } from './EventBus.js';
import { InputSystem } from '../input/InputSystem.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.time = new Time();
    this.camera = new Camera();
    this.bus = new EventBus();

    this._raf = 0;
    this._fpsFrames = 0;
    this._fpsAccum = 0;
    this.fps = 0;

    this.w = 0;
    this.h = 0;
    this.dpr = 1;

    // ctx — то, что передаём в InputSystem
    this.ctxObj = {
      game: this,
      camera: this.camera,
      bus: this.bus,
    };

    this.input = new InputSystem(canvas, this.ctxObj);

    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this._resize(), 100);
    });

    // пока ничего не делаем, но подписка есть
    this.bus.on('input:tap', (pos) => {
      console.log('tap at', pos);
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

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.camera.clampTo(1000, 1000, this.w, this.h);
  }

  start() {
    this.time.start(performance.now());
    this._raf = requestAnimationFrame(this._loop);
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this.input.dispose();
    this._raf = 0;
  }

  _loop = (now) => {
    this.time.tick(now);

    // FPS раз в секунду
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
    // пока пусто — сюда придёт MovementSystem и т.д. в фазе 2
  }

  _render() {
    const { ctx, w, h, camera } = this;

    // фон
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    // мир
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // карта 1000x1000
    ctx.fillStyle = '#2d3a2e';
    ctx.fillRect(0, 0, 1000, 1000);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / camera.zoom;
    ctx.strokeRect(0, 0, 1000, 1000);

    // сетка для наглядности движения
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1 / camera.zoom;
    ctx.beginPath();
    for (let x = 100; x < 1000; x += 100) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1000);
    }
    for (let y = 100; y < 1000; y += 100) {
      ctx.moveTo(0, y);
      ctx.lineTo(1000, y);
    }
    ctx.stroke();

    // красная точка в центре — маркер
    ctx.fillStyle = '#d52b1e';
    ctx.beginPath();
    ctx.arc(500, 500, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // HUD
    ctx.fillStyle = '#0f0';
    ctx.font = '14px ui-monospace, monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(
      `FPS: ${this.fps.toFixed(0)}  zoom: ${camera.zoom.toFixed(2)}  ${w}x${h} @${this.dpr}x`,
      10, 10
    );
  }
}
