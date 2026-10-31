export class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event).push(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const arr = this.handlers.get(event);
    if (!arr) return;
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  }

  emit(event, data) {
    const arr = this.handlers.get(event);
    if (arr) for (const fn of arr) fn(data);
  }
}
