import { BODY_PARTS, HEALTH_CONST } from '../data/anatomy.js';

export class Health {
  constructor() {
    this.parts = {};
    for (const key in BODY_PARTS) {
      const def = BODY_PARTS[key];
      this.parts[key] = {
        hp: def.hp,
        maxHp: def.hp,
        bleeding: 0,   // 0..1, скорость кровотечения
      };
    }
    this.bloodLoss = 0;      // 0..100
    this.pain = 0;           // 0..1
    this.dead = false;
    this.deathCause = null;
  }

  // Возвращает { died, part, amount, lethal }
  takeDamage(amount, hitPart = null, rng = Math.random) {
    if (this.dead) return { died: false, part: null, amount: 0 };

    let part = hitPart;
    if (!part) {
      // взвешенный рандом
      let r = rng();
      for (const key in BODY_PARTS) {
        r -= BODY_PARTS[key].hitWeight;
        if (r <= 0) { part = key; break; }
      }
      if (!part) part = 'torso';
    }

    const p = this.parts[part];
    if (!p) return { died: false, part: null, amount: 0 };

    const def = BODY_PARTS[part];
    const dmg = Math.max(0, amount);
    p.hp = Math.max(0, p.hp - dmg);
    p.bleeding = Math.min(1, p.bleeding + dmg * def.bleedFactor / 30);
    this.pain = Math.min(1, this.pain + dmg / 200);

    // витальная часть — смерть
    if (def.vital && p.hp <= 0) {
      this.dead = true;
      this.deathCause = part === 'head' ? 'голова' : 'торс';
      return { died: true, part, amount: dmg, lethal: true };
    }

    // потеря крови — тоже смерть
    if (this.bloodLoss >= HEALTH_CONST.bloodLossMax) {
      this.dead = true;
      this.deathCause = 'кровопотеря';
      return { died: true, part, amount: dmg, lethal: true };
    }

    return { died: false, part, amount: dmg, lethal: false };
  }

  update(dt) {
    if (this.dead) return;

    // кровотечение
    let totalBleed = 0;
    for (const key in this.parts) {
      const p = this.parts[key];
      if (p.bleeding > 0) totalBleed += p.bleeding;
    }
    if (totalBleed > 0) {
      this.bloodLoss = Math.min(
        HEALTH_CONST.bloodLossMax,
        this.bloodLoss + totalBleed * HEALTH_CONST.bleedPerSec * dt
      );
      if (this.bloodLoss >= HEALTH_CONST.bloodLossMax) {
        this.dead = true;
        this.deathCause = 'кровопотеря';
        return;
      }
    }

    // боль уходит
    this.pain = Math.max(0, this.pain - HEALTH_CONST.painDecayPerSec * dt);
  }

  // Множитель точности (1.0 = нет штрафа, 0.05 = почти не может стрелять)
  accuracyMult() {
    let mult = 1.0;
    for (const key in this.parts) {
      const p = this.parts[key];
      const def = BODY_PARTS[key];
      const ratio = p.hp / p.maxHp;
      if (ratio < 0.5) {
        mult -= def.accuracyPenalty * (1 - ratio / 0.5);
      }
      if (p.hp <= 0 && !def.vital) {
        mult -= def.accuracyPenalty;
      }
    }
    mult -= this.pain * HEALTH_CONST.painAccuracyMult;
    return Math.max(0.05, mult);
  }

  // Множитель скорости
  speedMult() {
    let mult = 1.0;
    for (const key in this.parts) {
      const p = this.parts[key];
      const def = BODY_PARTS[key];
      const ratio = p.hp / p.maxHp;
      if (ratio < 0.5) {
        mult -= def.speedPenalty * (1 - ratio / 0.5);
      }
      if (p.hp <= 0 && !def.vital) {
        mult -= def.speedPenalty;
      }
    }
    mult -= this.pain * HEALTH_CONST.painSpeedMult;
    mult -= this.bloodLoss * 0.003;
    return Math.max(0.1, mult);
  }

  canShoot() {
    return this.parts.rightArm.hp > 0 || this.parts.leftArm.hp > 0;
  }

  canWalk() {
    return this.parts.leftLeg.hp > 0 || this.parts.rightLeg.hp > 0;
  }

  totalHp() {
    let cur = 0;
    let max = 0;
    for (const key in this.parts) {
      cur += this.parts[key].hp;
      max += this.parts[key].maxHp;
    }
    return { current: Math.round(cur), max: Math.round(max) };
  }

  // для HUD
  getPart(key) {
    return this.parts[key];
  }

  // медицина
  heal(partKey, amount) {
    const p = this.parts[partKey];
    if (!p || p.hp >= p.maxHp) return false;
    p.hp = Math.min(p.maxHp, p.hp + amount);
    return true;
  }

  stopBleeding(partKey) {
    const p = this.parts[partKey];
    if (!p) return false;
    if (p.bleeding === 0) return false;
    p.bleeding = 0;
    return true;
  }

  stopAllBleeding() {
    let any = false;
    for (const key in this.parts) {
      if (this.parts[key].bleeding > 0) {
        this.parts[key].bleeding = 0;
        any = true;
      }
    }
    return any;
  }

  // сводка для HUD: "Ранена правая рука, кровотечение"
  statusText() {
    if (this.dead) return this.deathCause || 'убит';
    const parts = [];
    for (const key in this.parts) {
      const p = this.parts[key];
      const def = BODY_PARTS[key];
      if (p.hp <= 0 && !def.vital) {
        parts.push(`перебита ${def.name.toLowerCase()}`);
      } else if (p.hp / p.maxHp < 0.5) {
        parts.push(`ранена ${def.name.toLowerCase()}`);
      }
    }
    if (this.bloodLoss > 30) parts.push('сильное кровотечение');
    return parts.join(', ');
  }
}
