const TILE_SIZE = 10;

export class Renderer {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.ctx2d = canvas.getContext('2d', { alpha: false });
    this._bullets = [];
  }

  render() {
    const { game, camera, world } = this.ctx;
    const c = this.ctx2d;
    const w = game.w;
    const h = game.h;

    c.fillStyle = '#2d3a2e';
    c.fillRect(0, 0, w, h);

    c.save();
    c.translate(w / 2, h / 2);
    c.scale(camera.zoom, camera.zoom);
    c.translate(-camera.x, -camera.y);

    this._drawGrid(c, camera, world, w, h);
    this._drawObjective(c, world);
    this._drawObstacles(c, camera, world, w, h);
    this._drawUnits(c, world, camera);
    this._drawBullets(c);

    c.restore();
  }

  _drawGrid(c, camera, world, w, h) {
    const ts = TILE_SIZE;
    const left = camera.x - w / 2 / camera.zoom;
    const right = camera.x + w / 2 / camera.zoom;
    const top = camera.y - h / 2 / camera.zoom;
    const bottom = camera.y + h / 2 / camera.zoom;

    const tx0 = Math.max(0, Math.floor(left / ts));
    const tx1 = Math.min(Math.ceil(world.width / ts), Math.ceil(right / ts));
    const ty0 = Math.max(0, Math.floor(top / ts));
    const ty1 = Math.min(Math.ceil(world.height / ts), Math.ceil(bottom / ts));

    c.strokeStyle = 'rgba(255,255,255,0.06)';
    c.lineWidth = 0.05;
    c.beginPath();
    for (let tx = tx0; tx <= tx1; tx++) {
      const x = tx * ts;
      c.moveTo(x, Math.max(0, top));
      c.lineTo(x, Math.min(world.height, bottom));
    }
    for (let ty = ty0; ty <= ty1; ty++) {
      const y = ty * ts;
      c.moveTo(Math.max(0, left), y);
      c.lineTo(Math.min(world.width, right), y);
    }
    c.stroke();

    c.strokeStyle = 'rgba(255,255,255,0.12)';
    c.lineWidth = 0.15;
    c.beginPath();
    const bigTs = 100;
    const bx0 = Math.max(0, Math.floor(left / bigTs));
    const bx1 = Math.min(Math.ceil(world.width / bigTs), Math.ceil(right / bigTs));
    const by0 = Math.max(0, Math.floor(top / bigTs));
    const by1 = Math.min(Math.ceil(world.height / bigTs), Math.ceil(bottom / bigTs));
    for (let bx = bx0; bx <= bx1; bx++) {
      const x = bx * bigTs;
      c.moveTo(x, Math.max(0, top));
      c.lineTo(x, Math.min(world.height, bottom));
    }
    for (let by = by0; by <= by1; by++) {
      const y = by * bigTs;
      c.moveTo(Math.max(0, left), y);
      c.lineTo(Math.min(world.width, right), y);
    }
    c.stroke();

    c.strokeStyle = '#555';
    c.lineWidth = 0.5;
    c.strokeRect(0, 0, world.width, world.height);
  }

  _drawObjective(c, world) {
    const o = world.objective;
    c.beginPath();
    c.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
    if (o.owner === 'RU') c.fillStyle = 'rgba(213,43,30,0.15)';
    else if (o.owner === 'US') c.fillStyle = 'rgba(60,110,182,0.15)';
    else c.fillStyle = 'rgba(255,215,0,0.08)';
    c.fill();
    c.strokeStyle = o.owner === 'RU' ? '#d52b1e' : o.owner === 'US' ? '#3c6eb6' : '#ffd700';
    c.lineWidth = 0.3;
    c.stroke();

    c.fillStyle = '#ffd700';
    c.font = `bold 4px sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('★', o.x, o.y);
  }

  _drawObstacles(c, camera, world, w, h) {
    const left = camera.x - w / 2 / camera.zoom;
    const right = camera.x + w / 2 / camera.zoom;
    const top = camera.y - h / 2 / camera.zoom;
    const bottom = camera.y + h / 2 / camera.zoom;

    // кусты — под всеми
    for (const o of world.obstacles) {
      if (o.type !== 'bush') continue;
      if (o.x + o.w / 2 < left || o.x - o.w / 2 > right) continue;
      if (o.y + o.h / 2 < top || o.y - o.h / 2 > bottom) continue;
      c.fillStyle = o.color;
      c.beginPath();
      c.arc(o.x, o.y, o.w / 2, 0, Math.PI * 2);
      c.fill();
    }

    // деревья
    for (const o of world.obstacles) {
      if (o.type !== 'tree') continue;
      if (o.x + o.w / 2 < left || o.x - o.w / 2 > right) continue;
      if (o.y + o.h / 2 < top || o.y - o.h / 2 > bottom) continue;
      const r = o.w / 2;
      // ствол
      c.fillStyle = '#3a2a1a';
      c.beginPath();
      c.arc(o.x, o.y, r * 0.4, 0, Math.PI * 2);
      c.fill();
      // крона
      c.fillStyle = o.color;
      c.beginPath();
      c.arc(o.x, o.y, r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = o.borderColor;
      c.lineWidth = 0.15;
      c.stroke();
    }

    // дома, стены, машины
    for (const o of world.obstacles) {
      if (o.type === 'tree' || o.type === 'bush') continue;
      if (o.x + o.w / 2 < left || o.x - o.w / 2 > right) continue;
      if (o.y + o.h / 2 < top || o.y - o.h / 2 > bottom) continue;

      const x = o.x - o.w / 2;
      const y = o.y - o.h / 2;

      c.fillStyle = o.color;
      c.fillRect(x, y, o.w, o.h);
      c.strokeStyle = o.borderColor;
      c.lineWidth = 0.15;
      c.strokeRect(x, y, o.w, o.h);

      if (o.type === 'house') {
        // крыша — треугольник сверху
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.fillRect(x + o.w * 0.15, y + o.h * 0.15, o.w * 0.7, o.h * 0.7);
      } else if (o.type === 'car') {
        // стёкла
        c.fillStyle = 'rgba(200,220,255,0.4)';
        c.fillRect(x + o.w * 0.15, y + o.h * 0.2, o.w * 0.3, o.h * 0.6);
        c.fillRect(x + o.w * 0.55, y + o.h * 0.2, o.w * 0.3, o.h * 0.6);
      }
    }
  }

  _drawUnits(c, world, camera) {
    const selected = world.selectedUnits;
    for (const u of world.units) {
      if (u.dead) continue;

      const r = u.radius;

      c.fillStyle = u.team === 'RU' ? '#d52b1e' : '#3c6eb6';
      c.beginPath();
      c.arc(u.x, u.y, r, 0, Math.PI * 2);
      c.fill();

      c.strokeStyle = 'rgba(0,0,0,0.5)';
      c.lineWidth = 0.08;
      c.stroke();

      if (selected.includes(u)) {
        c.strokeStyle = '#ffd700';
        c.lineWidth = 0.12;
        c.beginPath();
        c.arc(u.x, u.y, r + 0.6, 0, Math.PI * 2);
        c.stroke();
      }

      const barrelLen = u.stance === 'prone' ? r * 1.8 : r * 1.5;
      c.strokeStyle = '#fff';
      c.lineWidth = 0.1;
      c.beginPath();
      c.moveTo(u.x, u.y);
      c.lineTo(
        u.x + Math.cos(u.facing) * barrelLen,
        u.y + Math.sin(u.facing) * barrelLen
      );
      c.stroke();

      if (u.role === 'commander' || u.role === 'squad_leader') {
        c.strokeStyle = '#ffd700';
        c.lineWidth = 0.08;
        c.beginPath();
        c.arc(u.x, u.y, r + 0.2, 0, Math.PI * 2);
        c.stroke();
      }

      if (u.muzzleFlash > 0) {
        c.fillStyle = '#ffaa00';
        const fx = u.x + Math.cos(u.facing) * (barrelLen + 0.3);
        const fy = u.y + Math.sin(u.facing) * (barrelLen + 0.3);
        c.beginPath();
        c.arc(fx, fy, 0.4, 0, Math.PI * 2);
        c.fill();
      }

      const hpFrac = u.hp / u.maxHp;
      if (hpFrac < 1) {
        const bw = 1.5;
        const bh = 0.25;
        const bx = u.x - bw / 2;
        const by = u.y - r - 1.0;
        c.fillStyle = 'rgba(0,0,0,0.6)';
        c.fillRect(bx, by, bw, bh);
        c.fillStyle = hpFrac > 0.5 ? '#3c3' : hpFrac > 0.25 ? '#fc3' : '#f33';
        c.fillRect(bx, by, bw * hpFrac, bh);
      }

      if (u.isReloading) {
        const prog = 1 - u.reloadTimer / u.weapon.reloadTime;
        c.strokeStyle = '#ffd700';
        c.lineWidth = 0.2;
        c.beginPath();
        c.arc(u.x, u.y, r + 1.0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog);
        c.stroke();
      }

      if (u.state === 'blocked') {
        c.fillStyle = '#ff4444';
        c.font = 'bold 2px sans-serif';
        c.textAlign = 'center';
        c.fillText('⚠', u.x, u.y - r - 1.5);
      }
    }
  }

  _drawBullets(c) {
    const now = performance.now();
    const BULLET_LIFE = 100;

    this._bullets = this._bullets.filter(b => now - b.born < BULLET_LIFE);

    for (const b of this._bullets) {
      const age = (now - b.born) / BULLET_LIFE;
      const alpha = 1 - age;

      const px = b.x + (b.tx - b.x) * age;
      const py = b.y + (b.ty - b.y) * age;
      const trailX = b.x + (b.tx - b.x) * Math.max(0, age - 0.15);
      const trailY = b.y + (b.ty - b.y) * Math.max(0, age - 0.15);

      c.strokeStyle = b.blocked
        ? `rgba(200,200,200,${alpha})`
        : b.team === 'RU'
          ? `rgba(255,221,85,${alpha})`
          : `rgba(102,221,255,${alpha})`;
      c.lineWidth = 0.15;
      c.beginPath();
      c.moveTo(trailX, trailY);
      c.lineTo(px, py);
      c.stroke();
    }
  }

  addBullet(shot) {
    this._bullets.push({
      x: shot.x,
      y: shot.y,
      tx: shot.tx,
      ty: shot.ty,
      team: shot.team,
      blocked: !!shot.blocked,
      born: performance.now(),
    });
  }
}
