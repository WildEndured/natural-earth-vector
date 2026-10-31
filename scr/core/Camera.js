export class Camera {
  constructor() {
    this.x = 500;
    this.y = 500;
    this.zoom = 1;
    this.minZoom = 0.5;
    this.maxZoom = 3;
  }

  screenToWorld(sx, sy, vw, vh) {
    return {
      x: (sx - vw / 2) / this.zoom + this.x,
      y: (sy - vh / 2) / this.zoom + this.y,
    };
  }

  worldToScreen(wx, wy, vw, vh) {
    return {
      x: (wx - this.x) * this.zoom + vw / 2,
      y: (wy - this.y) * this.zoom + vh / 2,
    };
  }

  clampTo(worldW, worldH, vw, vh) {
    const halfW = (vw / 2) / this.zoom;
    const halfH = (vh / 2) / this.zoom;

    if (worldW * this.zoom < vw) this.x = worldW / 2;
    else this.x = Math.max(halfW, Math.min(worldW - halfW, this.x));

    if (worldH * this.zoom < vh) this.y = worldH / 2;
    else this.y = Math.max(halfH, Math.min(worldH - halfH, this.y));
  }

  setZoomAt(newZoom, sx, sy, vw, vh) {
    const clamped = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
    if (clamped === this.zoom) return;

    const before = this.screenToWorld(sx, sy, vw, vh);
    this.zoom = clamped;
    const after = this.screenToWorld(sx, sy, vw, vh);

    this.x += before.x - after.x;
    this.y += before.y - after.y;
  }
}
