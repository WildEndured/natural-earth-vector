// ==================== HEALTH.JS ====================
// Система здоровья как в RimWorld: части тела, кровотечение, боль.

const BODY_PARTS = {
    head:    { name: 'Голова',   hp: 25, vital: true,  accuracy: 0.20, speed: 0.10 },
    torso:   { name: 'Торс',     hp: 40, vital: true,  accuracy: 0.00, speed: 0.20 },
    leftArm: { name: 'Левая рука', hp: 30, vital: false, accuracy: 0.30, speed: 0.00 },
    rightArm:{ name: 'Правая рука', hp: 30, vital: false, accuracy: 0.30, speed: 0.00 },
    leftLeg: { name: 'Левая нога', hp: 30, vital: false, accuracy: 0.00, speed: 0.30 },
    rightLeg:{ name: 'Правая нога', hp: 30, vital: false, accuracy: 0.00, speed: 0.30 }
};

// Вероятность попадания в часть (сумма = 1.0)
const HIT_WEIGHTS = {
    head: 0.08, torso: 0.42, leftArm: 0.12, rightArm: 0.12, leftLeg: 0.13, rightLeg: 0.13
};

class Health {
    constructor() {
        this.parts = {};
        for (const key in BODY_PARTS) {
            this.parts[key] = {
                hp: BODY_PARTS[key].hp,
                maxHp: BODY_PARTS[key].hp,
                bleeding: 0  // 0 = нет, >0 = кровотечение (урон/с)
            };
        }
        this.bloodLoss = 0;      // 0–100
        this.pain = 0;           // 0–1
        this.infected = false;
        this.dead = false;
        this.deathCause = null;
    }
    
    // ===== Получить урон =====
    takeDamage(amount, hitPart = null) {
        if (this.dead) return { died: false, part: null, amount: 0 };
        
        // Выбор части
        let part = hitPart;
        if (!part) {
            let r = Math.random();
            for (const key in HIT_WEIGHTS) {
                r -= HIT_WEIGHTS[key];
                if (r <= 0) { part = key; break; }
            }
            if (!part) part = 'torso';
        }
        
        const p = this.parts[part];
        if (!p) return { died: false, part: null, amount: 0 };
        
        // Урон
        const dmg = Math.max(0, amount);
        p.hp = Math.max(0, p.hp - dmg);
        p.bleeding += dmg * 0.3;  // 30% урона → кровотечение
        
        // Боль
        this.pain = Math.min(1, this.pain + dmg / 200);
        
        // Проверка смерти
        const vital = BODY_PARTS[part].vital;
        if (vital && p.hp <= 0) {
            this.dead = true;
            this.deathCause = part === 'head' ? 'голова' : 'торс';
            return { died: true, part, amount: dmg };
        }
        if (this.bloodLoss > 100) {
            this.dead = true;
            this.deathCause = 'кровопотеря';
            return { died: true, part, amount: dmg };
        }
        
        return { died: false, part, amount: dmg };
    }
    
    // ===== Тик =====
    update(dt) {
        if (this.dead) return;
        
        // Кровотечение
        let totalBleeding = 0;
        for (const key in this.parts) totalBleeding += this.parts[key].bleeding;
        if (totalBleeding > 0) {
            this.bloodLoss = Math.min(100, this.bloodLoss + totalBleeding * dt);
            if (this.bloodLoss >= 100) {
                this.dead = true;
                this.deathCause = 'кровопотеря';
                return;
            }
        }
        
        // Боль медленно спадает
        this.pain = Math.max(0, this.pain - dt * 0.02);
        
        // Инфекция (если есть кровотечение > 0 и не лечится)
        if (totalBleeding > 0 && Math.random() < dt * 0.001) {
            this.infected = true;
        }
        if (this.infected) {
            this.bloodLoss = Math.min(100, this.bloodLoss + dt * 0.5);
        }
    }
    
    // ===== Штраф к точности =====
    accuracyPenalty() {
        let penalty = 1.0;
        for (const key in this.parts) {
            const p = this.parts[key];
            const ratio = p.hp / p.maxHp;
            const eff = BODY_PARTS[key].accuracy;
            if (ratio < 0.5) penalty -= eff * (1 - ratio / 0.5);
            if (p.hp <= 0 && BODY_PARTS[key].vital === false) penalty -= eff;
        }
        // Боль
        penalty -= this.pain * 0.3;
        return Math.max(0.05, penalty);
    }
    
    // ===== Штраф к скорости =====
    speedPenalty() {
        let penalty = 1.0;
        for (const key in this.parts) {
            const p = this.parts[key];
            const ratio = p.hp / p.maxHp;
            const eff = BODY_PARTS[key].speed;
            if (ratio < 0.5) penalty -= eff * (1 - ratio / 0.5);
            if (p.hp <= 0 && BODY_PARTS[key].vital === false) penalty -= eff;
        }
        // Боль
        penalty -= this.pain * 0.2;
        // Кровопотеря
        penalty -= this.bloodLoss * 0.003;
        return Math.max(0.1, penalty);
    }
    
    // ===== Может ли стрелять =====
    canShoot() {
        return this.parts.rightArm.hp > 0 || this.parts.leftArm.hp > 0;
    }
    
    // ===== Может ли идти =====
    canWalk() {
        return this.parts.leftLeg.hp > 0 || this.parts.rightLeg.hp > 0;
    }
    
    // ===== Лечение =====
    heal(part, amount) {
        const p = this.parts[part];
        if (!p) return;
        p.hp = Math.min(p.maxHp, p.hp + amount);
        p.bleeding = Math.max(0, p.bleeding - amount * 0.5);
    }
    
    stopBleeding() {
        for (const key in this.parts) this.parts[key].bleeding = 0;
    }
    
    cureInfection() {
        this.infected = false;
    }
    
    // ===== Общий HP (для UI) =====
    totalHp() {
        let sum = 0, max = 0;
        for (const key in this.parts) {
            sum += this.parts[key].hp;
            max += this.parts[key].maxHp;
        }
        return { current: sum, max };
    }
                        }
