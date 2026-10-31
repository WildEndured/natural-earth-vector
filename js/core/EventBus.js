export class EventBus {
  constructor() { this.handlers = new Map(); }
  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(fn);
    return () => this.handlers.get(event)?.delete(fn);
  }
  emit(event, data) {
    const set = this.handlers.get(event);
    if (set) for (const fn of set) fn(data);
  }
  clear() { this.handlers.clear(); }
}
