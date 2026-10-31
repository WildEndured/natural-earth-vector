import { Time } from './Time.js';
import { Camera } from './Camera.js';
import { EventBus } from './EventBus.js';
import { RNG } from './RNG.js';
import { World } from '../world/World.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { InputSystem } from '../input/InputSystem.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.time = new Time();
    this.camera = new Camera();
    this.bus = new EventBus();
    this.rng = new RNG(12345);

    this._raf = 0;
    this._fpsFrames = 0;
    this._fpsAccum = 0;
    this.fps = 0;

    this.w = 0;
    this.h = 0;
    this.dpr = 1;

    // Мир и системы
    this.world = new World('test', this.rng);

    // общий ctx, который передаём системам
    this.ctxObj = {
      game: this,
      camera: this.camera,
      bus: this.bus,
      world: this.world,
      rng: this.rng,
    };

    this.movement = new MovementSystem(this.ctxObj);
    this.input = new InputSystem(canvas, this.ctxObj);

    // Спавн двух юнитов
    this._spawnUnits();

    // Реакция на тап
    this.bus.on('input:tap', (pos) => this._onTap(pos));

    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this._resize(), 100);
    });
  }

  _spawnUnits() {
    this.world.spawnUnit({
      team: 'RU',
      role: 'commander',
      roleName: 'Ком. отделения',
      weaponId: 'ak74m',
      x: 200,
      y: 500,
    });

    this.world.spawnUnit({
      team: 'US',
      role: 'squad_leader',
      roleName: 'Squad Leader',
      weaponId: 'm4a1',
      x: 800,
      y: 500,
    });
  }

  _onTap(pos) {
    // на MVP: тап = приказ первому живому RU-юниту идти в точку
    const ru = this.world.units.find((u) => u.team === 'RU' && u.alive);
    if (ru) {
      ru.moveTarget = { x: pos.x, y: pos.y };
    }
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
    this.camera.clampTo(this.world.width, this.world.height, this.w, this.h);
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
    this.movement.update(dt);
  }

  _render() {
    const { ctx, w, h, camera, world } = this;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // карта
    ctx.fillStyle = '#2d3a2e';
    ctx.fillRect(0, 0, world.width, world.height);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / camera.zoom;
    ctx.strokeRect(0, 0, world.width, world.height);

    // сетка
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1 / camera.zoom;
    ctx.beginPath();
    for (let x = 100; x < world.width; x += 100) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, world.height);
    }
    for (let y = 100; y < world.height; y += 100) {
      ctx.moveTo(0, y);
      ctx.lineTo(world.width, y);
    }
    ctx.stroke();

    // точка захвата
    const obj = world.objective;
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2 / camera.zoom;
    ctx.stroke();

    // пунктир до цели
    for (const u of world.units) {
      if (!u.alive || !u.moveTarget) continue;
      ctx.strokeStyle = u.team === 'RU' ? 'rgba(213,43,30,0.4)' : 'rgba(60,110,182,0.4)';
      ctx.lineWidth = 1.5 / camera.zoom;
      ctx.setLineDash([6 / camera.zoom, 6 / camera.zoom]);
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(u.moveTarget.x, u.moveTarget.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // юниты
    for (const u of world.units) {
      this._drawUnit(ctx, u, camera);
    }

    ctx.restore();

    // HUD
    ctx.fillStyle = '#0f0';
    ctx.font = '14px ui-monospace, monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(
      `FPS: ${this.fps.toFixed(0)}  zoom: ${camera.zoom.toFixed(2)}  units: ${world.aliveUnits().length}`,
      10, 10
    );
  }

  _drawUnit(ctx, u, camera) {
    if (!u.alive) {
      // мёртвый — тёмный эллипс
      ctx.fillStyle = 'rgba(60, 40, 40, 0.6)';
      ctx.beginPath();
      ctx.ellipse(u.x, u.y, u.radius * 1.4, u.radius * 0.7, u.facing, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const color = u.team === 'RU' ? '#d52b1e' : '#3c6eb6';

    // тело
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(u.x, u.y, u.radius, 0, Math.PI * 2);
    ctx.fill();

    // направление
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5 / camera.zoom;
    ctx.beginPath();
    ctx.moveTo(u.x, u.y);
    ctx.lineTo(
      u.x + Math.cos(u.facing) * (u.radius + 4),
      u.y + Math.sin(u.facing) * (u.radius + 4)
    );
    ctx.stroke();

    // HP-бар
    const hp = u.health.total();
    const frac = hp.current / hp.max;
    const bw = 16 / camera.zoom;
    const bh = 2 / camera.zoom;
    const by = u.y - u.radius - 8 / camera.zoom;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(u.x - bw / 2, by, bw, bh);
    ctx.fillStyle = frac > 0.5 ? '#3c3' : frac > 0.25 ? '#fc3' : '#f33';
    ctx.fillRect(u.x - bw / 2, by, bw * frac, bh);
  }
      }
