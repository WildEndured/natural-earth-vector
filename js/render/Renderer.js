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

    // фон
    c.fillStyle = '#2d3a2e';
    c.fillRect(0, 0, w, h);

    c.save();
    c.translate(w / 2, h / 2);
    c.scale(camera.zoom, camera.zoom);
    c.translate(-camera.x, -camera.y);

    this._drawGrid(c, camera, world, w, h);
    this._drawObjective(c, world);
    this._drawUnits(c, world, camera);
    this._drawBullets(c);

    c.restore();

    this._updateBullets();
  }

  _drawGrid(c, camera, world, w, h) {
    const ts = 64;
    const left = camera.x - w / 2 / camera.zoom;
    const right = camera.x + w / 2 / camera.zoom;
    const top = camera.y - h / 2 / camera.zoom;
    const bottom = camera.y + h / 2 / camera.zoom;

    const tx0 = Math.max(0, Math.floor(left / ts));
    const tx1 = Math.min(Math.ceil(world.width / ts), Math.ceil(right / ts));
    const ty0 = Math.max(0, Math.floor(top / ts));
    const ty1 = Math.min(Math.ceil(world.height / ts), Math.ceil(bottom / ts));

    c.strokeStyle = 'rgba(255,255,255,0.08)';
    c.lineWidth = 1 / camera.zoom;
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

    c.strokeStyle = '#555';
    c.lineWidth = 3 / camera.zoom;
    c.strokeRect(0, 0, world.width, world.height);
  }

  _drawObjective(c, world) {
    const o = world.objective;
    c.beginPath();
    c.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
    if (o.owner === 'RU') c.fillStyle = 'rgba(213,43,30,0.2)';
    else if (o.owner === 'US') c.fillStyle = 'rgba(60,110,182,0.2)';
    else c.fillStyle = 'rgba(255,215,0,0.12)';
    c.fill();
    c.strokeStyle = o.owner === 'RU' ? '#d52b1e' : o.owner === 'US' ? '#3c6eb6' : '#ffd700';
    c.lineWidth = 2 / this.ctx.camera.zoom;
    c.stroke();

    c.fillStyle = '#ffd700';
    c.font = `bold ${20 / this.ctx.camera.zoom}px sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('★', o.x, o.y);
  }

  _drawUnits(c, world, camera) {
    const selected = world.selectedUnits;
    for (const u of world.units) {
      if (u.dead) continue;

      // тело
      c.fillStyle = u.team === 'RU' ? '#d52b1e' : '#3c6eb6';
      c.beginPath();
      c.arc(u.x, u.y, u.radius, 0, Math.PI * 2);
      c.fill();

      // контур выделения
      if (selected.includes(u)) {
        c.strokeStyle = '#ffd700';
        c.lineWidth = 1.5 / camera.zoom;
        c.beginPath();
        c.arc(u.x, u.y, u.radius + 3, 0, Math.PI * 2);
        c.stroke();
      }

      // ствол
      c.strokeStyle = '#fff';
      c.lineWidth = 1.5 / camera.zoom;
      c.beginPath();
      c.moveTo(u.x, u.y);
      c.lineTo(
        u.x + Math.cos(u.facing) * (u.radius + 4),
        u.y + Math.sin(u.facing) * (u.radius + 4)
      );
      c.stroke();

      // лидер
      if (u.role === 'commander' || u.role === 'squad_leader') {
        c.strokeStyle = '#ffd700';
        c.lineWidth = 1 / camera.zoom;
        c.beginPath();
        c.arc(u.x, u.y, u.radius, 0, Math.PI * 2);
        c.stroke();
      }

      // muzzle flash
      if (u.muzzleFlash > 0) {
        c.fillStyle = '#ffaa00';
        const fx = u.x + Math.cos(u.facing) * (u.radius + 2);
        const fy = u.y + Math.sin(u.facing) * (u.radius + 2);
        c.beginPath();
        c.arc(fx, fy, 2.5, 0, Math.PI * 2);
        c.fill();
      }

      // hp bar
      const hpFrac = u.hp / u.maxHp;
      if (hpFrac < 1) {
        const bw = 12 / camera.zoom;
        const bh = 2 / camera.zoom;
        const bx = u.x - bw / 2;
        const by = u.y - u.radius - 6 / camera.zoom;
        c.fillStyle = 'rgba(0,0,0,0.6)';
        c.fillRect(bx, by, bw, bh);
        c.fillStyle = hpFrac > 0.5 ? '#3c3' : hpFrac > 0.25 ? '#fc3' : '#f33';
        c.fillRect(bx, by, bw * hpFrac, bh);
      }

      // reloading
      if (u.isReloading) {
        const prog = 1 - u.reloadTimer / u.weapon.reloadTime;
        c.strokeStyle = '#ffd700';
        c.lineWidth = 2 / camera.zoom;
        c.beginPath();
        c.arc(u.x, u.y, u.radius + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog);
        c.stroke();
      }
    }
  }

  _drawBullets(c) {
    for (const b of this._bullets) {
      const alpha = b.life / b.maxLife;
      c.strokeStyle = b.team === 'RU' ? `rgba(255,221,85,${alpha})` : `rgba(102,221,255,${alpha})`;
      c.lineWidth = 1.5 / this.ctx.camera.zoom;
      c.beginPath();
      c.moveTo(b.x, b.y);
      c.lineTo(b.tx, b.ty);
      c.stroke();
    }
  }

  _updateBullets() {
    const now = performance.now();
    this._bullets = this._bullets.filter(b => b.life > 0);
    for (const b of this._bullets) {
      b.life -= 1;
    }
  }

  addBullet(shot) {
    this._bullets.push({
      x: shot.x,
      y: shot.y,
      tx: shot.tx,
      ty: shot.ty,
      team: shot.team,
      life: 10,
      maxLife: 10,
    });
  }
}
