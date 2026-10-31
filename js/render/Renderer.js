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

    for (const o of world.obstacles) {
      // culling
      if (o.x + o.w / 2 < left || o.x - o.w / 2 > right) continue;
      if (o.y + o.h / 2 < top || o.y - o.h / 2 > bottom) continue;

      const x = o.x - o.w / 2;
      const y = o.y - o.h / 2;

      if (o.type === 'tree') {
        // ствол
        c.fillStyle = '#3a2a1a';
        c.beginPath();
