export class InputSystem {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.pointers = new Map();
    this._panStart = null;
    this._pinchStart = null;
    this._tapStart = null;
    this._dragThreshold = 10;

    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);

    canvas.addEventListener('pointerdown', this._onDown, { passive: false });
    canvas.addEventListener('pointermove', this._onMove, { passive: false });
    canvas.addEventListener('pointerup', this._onUp, { passive: false });
    canvas.addEventListener('pointercancel', this._onUp, { passive: false });
    canvas.addEventListener('wheel', this._onWheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  _onDown(e) {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.canvas.setPointerCapture(e.pointerId);

    if (this.pointers.size === 1) {
      this._panStart = {
        x: e.clientX,
        y: e.clientY,
        camX: this.ctx.camera.x,
        camY: this.ctx.camera.y,
      };
      this._tapStart = {
        x: e.clientX,
        y: e.clientY,
        t: performance.now(),
      };
    } else if (this.pointers.size === 2) {
      this._startPinch();
    }
    e.preventDefault();
  }

  _onMove(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;

    if (this.pointers.size === 1 && this._panStart) {
      const dx = e.clientX - this._panStart.x;
      const dy = e.clientY - this._panStart.y;
      this.ctx.camera.x = this._panStart.camX - dx / this.ctx.camera.zoom;
      this.ctx.camera.y = this._panStart.camY - dy / this.ctx.camera.zoom;
      this.ctx.camera.clampTo(
        this.ctx.world.width,
        this.ctx.world.height,
        this.ctx.game.w,
        this.ctx.game.h
      );
    } else if (this.pointers.size === 2) {
      this._updatePinch();
    }
    e.preventDefault();
  }

  _onUp(e) {
    const wasSingle = this.pointers.size === 1;
    this.pointers.delete(e.pointerId);

    if (this.pointers.size === 0 && wasSingle && this._tapStart) {
      const dt = performance.now() - this._tapStart.t;
      const dist = Math.hypot(e.clientX - this._tapStart.x, e.clientY - this._tapStart.y);
      if (dt < 300 && dist < this._dragThreshold) {
        const wp = this.ctx.camera.screenToWorld(
          e.clientX,
          e.clientY,
          this.ctx.game.w,
          this.ctx.game.h
        );
        this.ctx.bus.emit('input:tap', { worldX: wp.x, worldY: wp.y });
      }
      this._tapStart = null;
      this._panStart = null;
    } else if (this.pointers.size === 1) {
      this._startPinch();
    }
    this._pinchStart = null;
  }

  _onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.ctx.camera.zoomAt(
      e.clientX,
      e.clientY,
      factor,
      this.ctx.game.w,
      this.ctx.game.h
    );
    this.ctx.camera.clampTo(
      this.ctx.world.width,
      this.ctx.world.height,
      this.ctx.game.w,
      this.ctx.game.h
    );
  }

  _startPinch() {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    this._pinchStart = {
      dist: Math.hypot(b.x - a.x, b.y - a.y),
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
      zoom: this.ctx.camera.zoom,
    };
  }

  _updatePinch() {
    if (!this._pinchStart) return;
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const factor = dist / this._pinchStart.dist;
    const targetZoom = Math.max(
      this.ctx.camera.minZoom,
      Math.min(this.ctx.camera.maxZoom, this._pinchStart.zoom * factor)
    );
    const vw = this.ctx.game.w;
    const vh = this.ctx.game.h;
    const before = this.ctx.camera.screenToWorld(this._pinchStart.cx, this._pinchStart.cy, vw, vh);
    this.ctx.camera.zoom = targetZoom;
    const after = this.ctx.camera.screenToWorld(this._pinchStart.cx, this._pinchStart.cy, vw, vh);
    this.ctx.camera.x += before.x - after.x;
    this.ctx.camera.y += before.y - after.y;
    this.ctx.camera.clampTo(
      this.ctx.world.width,
      this.ctx.world.height,
      vw,
      vh
    );
  }

  dispose() {
    this.canvas.removeEventListener('pointerdown', this._onDown);
    this.canvas.removeEventListener('pointermove', this._onMove);
    this.canvas.removeEventListener('pointerup', this._onUp);
    this.canvas.removeEventListener('pointercancel', this._onUp);
    this.canvas.removeEventListener('wheel', this._onWheel);
  }
}
