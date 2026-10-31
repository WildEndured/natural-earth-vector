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
    c.font = 'bold 4px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('★', o.x, o.y);
  }

  _drawObstacles(c, camera, world, w, h) {
    const left = camera.x - w / 2 / camera.zoom;
    const right = camera.x + w / 2 / camera.zoom;
    const top = camera.y - h / 2 / camera.zoom;
    const bottom = camera.y + h / 2 / camera.zoom;

    for (const o of world.obstacles) {
      if (o.type !== 'bush') continue;
      if (o.x + o.w / 2 < left || o.x - o.w / 2 > right) continue;
      if (o.y + o.h / 2 < top || o.y - o.h / 2 > bottom) continue;
      c.fillStyle = o.color;
      c.beginPath();
      c.arc(o.x, o.y, o.w / 2, 0, Math.PI * 2);
      c.fill();
    }

    for (const o of world.obstacles) {
      if (o.type !== 'tree') continue;
      if (o.x + o.w / 2 < left || o.x - o.w / 2 > right) continue;
      if (o.y + o.h / 2 < top || o.y - o.h / 2 > bottom) continue;
      const r = o.w / 2;
      c.fillStyle = '#3a2a1a';
      c.beginPath();
      c.arc(o.x, o.y, r * 0.4, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = o.color;
      c.beginPath();
      c.arc(o.x, o.y, r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = o.borderColor;
      c.lineWidth = 0.15;
      c.stroke();
    }

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
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.fillRect(x + o.w * 0.15, y + o.h * 0.15, o.w * 0.7, o.h * 0.7);
      } else if (o.type === 'car') {
        c.fillStyle = 'rgba(200,220,255,0.4)';
        c.fillRect(x + o.w * 0.15, y + o.h * 0.2, o.w * 0.3, o.h * 0.6);
        c.fillRect(x + o.w * 0.55, y + o.h * 0.2, o.w * 0.3, o.h * 0.6);
      }
    }
  }

  _drawUnits(c, world, camera) {
    const selected = world.selectedUnits;
    for (const u of world.units) {
      if (u.dead) {
        // тело убитого — серый крестик
        c.strokeStyle = 'rgba(80,80,80,0.6)';
        c.lineWidth = 0.15;
        const r = u.radius * 0.8;
        c.beginPath();
        c.moveTo(u.x - r, u.y - r);
        c.lineTo(u.x + r, u.y + r);
        c.moveTo(u.x + r, u.y - r);
        c.lineTo(u.x - r, u.y + r);
        c.stroke();
        continue;
      }

      const r = u.radius;

      // цвет тела: сильно ранен — тусклее
      const hpFrac = u.hp / u.maxHp;
      let baseColor;
      if (u.team === 'RU') {
        baseColor = hpFrac > 0.5 ? '#d52b1e' : hpFrac > 0.25 ? '#a03028' : '#802020';
      } else {
        baseColor = hpFrac > 0.5 ? '#3c6eb6' : hpFrac > 0.25 ? '#305a90' : '#204070';
      }

      // "не может идти" — обводка коричневым
      if (!u.health.canWalk()) {
        c.strokeStyle = '#8a4a1a';
        c.lineWidth = 0.18;
        c.beginPath();
        c.arc(u.x, u.y, r + 0.5, 0, Math.PI * 2);
        c.stroke();
      }

      c.fillStyle = baseColor;
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
      c.strokeStyle = u.health.canShoot() ? '#fff' : '#555';
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

      // HP-бар по частям (голова + торс = "жизнь", руки/ноги — тонкие полоски)
      const bw = 1.8;
      const bh = 0.3;
      const bx = u.x - bw / 2;
      const by = u.y - r - 1.2;

      // фон
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.fillRect(bx, by, bw, bh);

      // торс (главный HP)
      const torsoHp = u.health.parts.torso.hp;
      const torsoMax = u.health.parts.torso.maxHp;
      const headHp = u.health.parts.head.hp;
      const headMax = u.health.parts.head.maxHp;
      const vitalFrac = (torsoHp + headHp) / (torsoMax + headMax);

      c.fillStyle = vitalFrac > 0.5 ? '#3c3' : vitalFrac > 0.25 ? '#fc3' : '#f33';
      c.fillRect(bx, by, bw * vitalFrac, bh);

      // индикатор рук/ног (тонкая линия под HP-баром)
      const limbY = by + bh + 0.05;
      const limbH = 0.1;
      const armL = u.health.parts.leftArm.hp / u.health.parts.leftArm.maxHp;
      const armR = u.health.parts.rightArm.hp / u.health.parts.rightArm.maxHp;
      const legL = u.health.parts.leftLeg.hp / u.health.parts.leftLeg.maxHp;
      const legR = u.health.parts.rightLeg.hp / u.health.parts.rightLeg.maxHp;
      const segW = bw / 4;

      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(bx, limbY, bw, limbH);

      c.fillStyle = armL > 0.5 ? '#4a9' : '#a44';
      c.fillRect(bx, limbY, segW * armL, limbH);
      c.fillStyle = armR > 0.5 ? '#4a9' : '#a44';
      c.fillRect(bx + segW, limbY, segW * armR, limbH);
      c.fillStyle = legL > 0.5 ? '#4a9' : '#a44';
      c.fillRect(bx + segW * 2, limbY, segW * legL, limbH);
      c.fillStyle = legR > 0.5 ? '#4a9' : '#a44';
      c.fillRect(bx + segW * 3, limbY, segW * legR, limbH);

      // кровотечение — красная капля
      if (u.health.bloodLoss > 20) {
        const alpha = Math.min(1, u.health.bloodLoss / 100);
        c.fillStyle = `rgba(220,30,30,${alpha})`;
        c.beginPath();
        c.arc(u.x + r + 0.6, u.y - r - 0.6, 0.35, 0, Math.PI * 2);
        c.fill();
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
        c.fillText('⚠', u.x, u.y - r - 2.2);
      } else if (u.state === 'crippled') {
        c.fillStyle = '#8a4a1a';
        c.font = 'bold 2px sans-serif';
        c.textAlign = 'center';
        c.fillText('🦽', u.x, u.y - r - 2.2);
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

      if (b.hit) {
        // попадание — красная
        c.strokeStyle = `rgba(255,80,80,${alpha})`;
      } else if (b.hitPart) {
        // попадание в часть — жёлтая
        c.strokeStyle = `rgba(255,200,50,${alpha})`;
      } else if (b.blocked) {
        c.strokeStyle = `rgba(200,200,200,${alpha})`;
      } else {
        c.strokeStyle = b.team === 'RU'
          ? `rgba(255,221,85,${alpha})`
          : `rgba(102,221,255,${alpha})`;
      }

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
      hit: !!shot.hit,
      hitPart: !!shot.hitPart,
      blocked: !!shot.blocked,
      born: performance.now(),
    });
  }
        }
