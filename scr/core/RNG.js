export class RNG {
  constructor(seed = 12345) {
    this.seed = seed >>> 0;
  }

  next() {
    let t = (this.seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a, b) {
    return a + (b - a) * this.next();
  }

  chance(p) {
    return this.next() < p;
  }

  int(a, b) {
    return Math.floor(this.range(a, b + 1));
  }
}
