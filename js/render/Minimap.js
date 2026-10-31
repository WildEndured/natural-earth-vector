export class Minimap {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.c = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.cssW = 100;
    this.cssH = 100;
    this.canvas.width = this.cssW * dpr;
    this.canvas.height = this.cssH * dpr;
    this.canvas.style.width = this.cssW + 'px';
    this.canvas.style.height = this.cssH + 'px';
    this.c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  render() {
    const { world, camera, game } = this.ctx;
    const c = this.c;
    const w = this.cssW;
    const h = this.cssH;

    c.fillStyle = 'rgba(20,30,20,0.95)';
    c.fillRect(0, 0, w, h);

    const sx = w / world.width;
    const sy = h / world.height;

    // точка
    const o = world.objective;
    c.beginPath();
    c.arc(o.x * sx, o.y * sy, Math.max(4, o.radius * sx), 0, Math.PI * 2);
    if (o.owner === 'RU') c.fillStyle = 'rgba(213,43,30,0.35)';
    else if (o.owner === 'US') c.fillStyle = 'rgba(60,110,182,0.35)';
    else c.fillStyle = 'rgba(255,215,0,0.2)';
    c.fill();
    c.strokeStyle = '#ffd700';
    c.lineWidth = 1;
    c.stroke();

    // юниты
    for (const u of world.units) {
      if (u.dead) continue;
      c.fillStyle = u.team === 'RU' ? '#d52b1e' : '#3c6eb6';
      c.beginPath();
      c.arc(u.x * sx, u.y * sy, 1.5, 0, Math.PI * 2);
      c.fill();
    }

    // рамка камеры
    const halfW = (game.w / 2) / camera.zoom;
    const halfH = (game.h / 2) / camera.zoom;
    c.strokeStyle = 'rgba(255,255,255,0.8)';
    c.lineWidth = 1;
    c.strokeRect(
      (camera.x - halfW) * sx,
      (camera.y - halfH) * sy,
      halfW * 2 * sx,
      halfH * 2 * sy
    );
  }
}
