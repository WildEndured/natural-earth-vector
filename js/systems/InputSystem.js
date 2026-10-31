export class InputSystem {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.pointers = new Map();
    this._panStart = null;
    this._pinchStart = null;
    this._tapStart = null;
    this._dragThreshold = 10;   // в пикселях экрана — не зависит от масштаба

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
    p.x = e.client
