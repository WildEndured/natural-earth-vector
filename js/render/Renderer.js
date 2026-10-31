export class Renderer {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.ctx2d = canvas.getContext('2d', { alpha: false });
  }

  render() {
    const { game, camera, world } = this.ctx;
    const c = this.ctx2d;
    const w = game.w, h = game.h;

    c.fillStyle = '#2d3a2e';
    c.fillRect(0, 0, w, h);

    c.save();
    c.translate(w / 2, h / 2);
    c.scale(camera.zoom, camera.zoom);
    c.translate(-camera.x, -camera.y);

    // сетка — только видимые тайлы
    const ts = world.tileSize;
    const left = camera.x - w / 2 / camera.zoom;
    const right = camera.x + w / 2 / camera.zoom;
    const top = camera.y - h / 2 / camera.zoom;
    const bottom = camera.y + h / 2 / camera.zoom;
    const tx0 = Math.max(0, Math.floor(left / ts));
    const tx1 = Math.min(Math.ceil(world.width / ts) - 1, Math.ceil(right / ts));
    const ty0 = Math.max(0, Math.floor(top / ts));
    const ty1 = Math.min(Math.ceil(world.height / ts) - 1, Math.ceil(bottom / ts));

    c.strokeStyle = 'rgba(255,255,255,0.08)';
    c.lineWidth = 1 / camera.zoom;
    c.beginPath();
    for (let tx = tx0; tx <= tx1; tx++) {
      const x = tx * ts;
      c.moveTo(x, top); c.lineTo(x, bottom);
    }
    for (let ty = ty0; ty <= ty1; ty++) {
      const y = ty * ts;
      c.moveTo(left, y); c.lineTo(right, y);
    }
    c.stroke();

    // точка
    const o = world.objective;
    c.beginPath();
    c.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,215,0,0.15)';
    c.fill();
    c.strokeStyle = '#ffd700';
    c.lineWidth = 2 / camera.zoom;
    c.stroke();

    c.restore();
  }

  drawUnits() {
  const c = this.ctx2d;
  const cam = this.ctx.camera;
  for (const u of this.ctx.world.units) {
    if (u.dead) continue;
    c.fillStyle = u.team === 'RU' ? '#d52b1e' : '#3c6eb6';
    c.beginPath();
    c.arc(u.x, u.y, u.radius, 0, Math.PI * 2);
    c.fill();
    // ствол
    c.strokeStyle = '#fff';
    c.lineWidth = 1.5 / cam.zoom;
    c.beginPath();
    c.moveTo(u.x, u.y);
    c.lineTo(u.x + Math.cos(u.facing) * (u.radius + 4), u.y + Math.sin(u.facing) * (u.radius + 4));
    c.stroke();
    // hp bar
    const bw = 12 / cam.zoom;
    const bh = 2 / cam.zoom;
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(u.x - bw / 2, u.y - u.radius - 6 / cam.zoom, bw, bh);
    c.fillStyle = u.hp / u.maxHp > 0.5 ? '#3c3' : '#f33';
    c.fillRect(u.x - bw / 2, u.y - u.radius - 6 / cam.zoom, bw * (u.hp / u.maxHp), bh);
  }
      }
