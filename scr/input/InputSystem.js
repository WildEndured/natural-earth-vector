export class InputSystem {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    this.pointers = new Map();
    this.lastPinchDist = 0;
    this.dragging = false;
    this.dragStart = { x: 0, y: 0 };

    canvas.addEventListener('pointerdown', this._onDown);
    canvas.addEventListener('pointermove', this._onMove);
    canvas.addEventListener('pointerup', this._onUp);
    canvas.addEventListener('pointercancel', this._onUp);
    canvas.addEventListener('wheel', this._onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _onDown = (e) => {
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size === 1) {
      this.dragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
    }

    if (this.pointers.size === 2) {
      this.dragging = false;
      const [a, b] = [...this.pointers.values()];
      this.lastPinchDist = Math.hypot(b.x - a.x, b.y - a.y);
    }
  };

  _onMove = (e) => {
    if (!this.pointers.has(e.pointerId)) return;
    const prev = this.pointers.get(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const { camera, game } = this.ctx;
    const vw = game.w;
    const vh = game.h;

    if (this.pointers.size === 1 && this.dragging) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      camera.x -= dx / camera.zoom;
      camera.y -= dy / camera.zoom;
      camera.clampTo(1000, 1000, vw, vh);
    }

    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

      if (this.lastPinchDist > 0) {
        const factor = dist / this.lastPinchDist;
        camera.setZoomAt(camera.zoom * factor, center.x, center.y, vw, vh);
        camera.clampTo(1000, 1000, vw, vh);
      }

      this.lastPinchDist = dist;
    }
  };

  _onUp = (e) => {
    const had = this.pointers.delete(e.pointerId);
    if (!had) return;
    if (this.pointers.size < 2) this.lastPinchDist = 0;

    if (this.pointers.size === 0 && this.dragging) {
      const moved = Math.hypot(e.clientX - this.dragStart.x, e.clientY - this.dragStart.y);
      this.dragging = false;

      if (moved < 10) {
        const { camera, game, bus } = this.ctx;
        const world = camera.screenToWorld(e.clientX, e.clientY, game.w, game.h);
        bus.emit('input:tap', world);
      }
    }
  };

  _onWheel = (e) => {
    e.preventDefault();
    const { camera, game } = this.ctx;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    camera.setZoomAt(camera.zoom * factor, e.clientX, e.clientY, game.w, game.h);
    camera.clampTo(1000, 1000, game.w, game.h);
  };

  dispose() {
    this.canvas.removeEventListener('pointerdown', this._onDown);
    this.canvas.removeEventListener('pointermove', this._onMove);
    this.canvas.removeEventListener('pointerup', this._onUp);
    this.canvas.removeEventListener('pointercancel', this._onUp);
    this.canvas.removeEventListener('wheel', this._onWheel);
  }
}
