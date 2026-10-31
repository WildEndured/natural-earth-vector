export class Camera {
  constructor({ x = 0, y = 0, zoom = 1, minZoom = 0.3, maxZoom = 4 } = {}) {
    this.x = x;
    this.y = y;
    this.zoom = zoom;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
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

  zoomAt(sx, sy, factor, vw, vh) {
    const before = this.screenToWorld(sx, sy, vw, vh);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    const after = this.screenToWorld(sx, sy, vw, vh);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
  }
}
