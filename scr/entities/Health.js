import { BODY, HEALTH } from '../data/anatomy.js';

export class Health {
  constructor(rng) {
    this.rng = rng;
    this.parts = {};
    for (const k in BODY) {
      this.parts[k] = { hp: BODY[k].hp, maxHp: BODY[k].hp, bleeding: 0 };
    }
    this.bloodLoss = 0;
    this.pain = 0;
    this.dead = false;
  }

  takeDamage(amount, part = null) {
    if (this.dead || amount <= 0) return { died: false, part: null };
    if (!part) part = this._randomPart();
    const p = this.parts[part];
    p.hp = Math.max(0, p.hp - amount);
    p.bleeding += amount * HEALTH.bleedPerDamage;
    this.pain = Math.min(1, this.pain + amount * HEALTH.painPerDamage);
    if (BODY[part].vital && p.hp <= 0) {
      this.dead = true;
      return { died: true, part };
    }
    return { died: false, part };
  }

  _randomPart() {
    let r = this.rng.next();
    for (const k in BODY) {
      r -= BODY[k].hitWeight;
      if (r <= 0) return k;
    }
    return 'torso';
  }

  update(dt) {
    if (this.dead) return;
    let bleed = 0;
    for (const k in this.parts) bleed += this.parts[k].bleeding;
    if (bleed > 0) {
      this.bloodLoss = Math.min(100, this.bloodLoss + bleed * dt);
      if (this.bloodLoss >= HEALTH.bloodLossDeath) {
        this.dead = true;
        return;
      }
    }
    this.pain = Math.max(0, this.pain - HEALTH.painDecayPerSec * dt);
  }

  total() {
    let cur = 0, max = 0;
    for (const k in this.parts) {
      cur += this.parts[k].hp;
      max += this.parts[k].maxHp;
    }
    return { current: cur, max };
  }

  accuracyMult() {
    let m = 1;
    for (const k in this.parts) {
      const p = this.parts[k];
      const ratio = p.hp / p.maxHp;
      if (ratio < 0.5) m -= BODY[k].accPenalty * (1 - ratio / 0.5);
      if (p.hp <= 0 && !BODY[k].vital) m -= BODY[k].accPenalty;
    }
    m -= this.pain * 0.3;
    return Math.max(0.05, m);
  }

  speedMult() {
    let m = 1;
    for (const k in this.parts) {
      const p = this.parts[k];
      const ratio = p.hp / p.maxHp;
      if (ratio < 0.5) m -= BODY[k].speedPenalty * (1 - ratio / 0.5);
      if (p.hp <= 0 && !BODY[k].vital) m -= BODY[k].speedPenalty;
    }
    m -= this.pain * 0.2;
    m -= this.bloodLoss * 0.003;
    return Math.max(0.1, m);
  }
}
