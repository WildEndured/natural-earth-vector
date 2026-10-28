// ==================== ENTITIES.JS ====================

function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }

function pointInRect(x, y, rect, padding = 0) {
    return x > rect.x - rect.w / 2 - padding && x < rect.x + rect.w / 2 + padding &&
           y > rect.y - rect.h / 2 - padding && y < rect.y + rect.h / 2 + padding;
}

function pointInAnyObstacle(x, y, obstacles, skipTypes = []) {
    for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        if (skipTypes.indexOf(obs.type) !== -1) continue;
        if (pointInRect(x, y, obs)) return obs;
    }
    return null;
}

function segmentIntersectsRect(x1, y1, x2, y2, rect) {
    const minX = rect.x - rect.w / 2, maxX = rect.x + rect.w / 2;
    const minY = rect.y - rect.h / 2, maxY = rect.y + rect.h / 2;
    let t0 = 0, t1 = 1;
    const dx = x2 - x1, dy = y2 - y1;
    const p = [-dx, dx, -dy, dy];
    const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];
    for (let i = 0; i < 4; i++) {
        if (p[i] === 0) { if (q[i] < 0) return false; }
        else {
            const r = q[i] / p[i];
            if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
            else { if (r < t0) return false; if (r < t1) t1 = r; }
        }
    }
    return t0 < t1;
}

function rayBlocked(x1, y1, x2, y2, obstacles) {
    for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        if (obs.type === 'tree') continue;
        if (segmentIntersectsRect(x1, y1, x2, y2, obs)) return obs;
    }
    return null;
}

function nearestCoverPoint(x, y, obstacles, maxDist) {
    let best = null, bestDist = maxDist;
    for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        if (obs.type === 'tree' || obs.type === 'bush') continue;
        const dx = x - obs.x, dy = y - obs.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.01 || d > maxDist) continue;
        const halfW = obs.w / 2, halfH = obs.h / 2;
        const dirX = -dx / d, dirY = -dy / d;
        const tX = dirX !== 0 ? halfW / Math.abs(dirX) : Infinity;
        const tY = dirY !== 0 ? halfH / Math.abs(dirY) : Infinity;
        const t = Math.min(tX, tY);
        const px = obs.x + dirX * t - dirX * 1.5;
        const py = obs.y + dirY * t - dirY * 1.5;
        const edgeDist = Math.hypot(px - x, py - y);
        if (edgeDist < bestDist) { bestDist = edgeDist; best = { x: px, y: py }; }
    }
    return best;
}

const BODY_PARTS = {
    head:     { name: 'Голова',      hp: 25, vital: true,  accuracy: 0.20, speed: 0.10 },
    torso:    { name: 'Торс',        hp: 40, vital: true,  accuracy: 0.00, speed: 0.20 },
    leftArm:  { name: 'Левая рука',  hp: 30, vital: false, accuracy: 0.30, speed: 0.00 },
    rightArm: { name: 'Правая рука', hp: 30, vital: false, accuracy: 0.30, speed: 0.00 },
    leftLeg:  { name: 'Левая нога',  hp: 30, vital: false, accuracy: 0.00, speed: 0.30 },
    rightLeg: { name: 'Правая нога', hp: 30, vital: false, accuracy: 0.00, speed: 0.30 }
};
const HIT_WEIGHTS = { head: 0.08, torso: 0.42, leftArm: 0.12, rightArm: 0.12, leftLeg: 0.13, rightLeg: 0.13 };

class Health {
    constructor() {
        this.parts = {};
        for (const key in BODY_PARTS) this.parts[key] = { hp: BODY_PARTS[key].hp, maxHp: BODY_PARTS[key].hp, bleeding: 0 };
        this.bloodLoss = 0; this.pain = 0; this.infected = false; this.dead = false; this.deathCause = null;
    }
    takeDamage(amount, hitPart = null) {
        if (this.dead) return { died: false, part: null, amount: 0 };
        let part = hitPart;
        if (!part) {
            let r = Math.random();
            for (const key in HIT_WEIGHTS) { r -= HIT_WEIGHTS[key]; if (r <= 0) { part = key; break; } }
            if (!part) part = 'torso';
        }
        const p = this.parts[part];
        if (!p) return { died: false, part: null, amount: 0 };
        const dmg = Math.max(0, amount);
        p.hp = Math.max(0, p.hp - dmg); p.bleeding += dmg * 0.3; this.pain = Math.min(1, this.pain + dmg / 200);
        if (BODY_PARTS[part].vital && p.hp <= 0) { this.dead = true; this.deathCause = part === 'head' ? 'голова' : 'торс'; return { died: true, part, amount: dmg }; }
        return { died: false, part, amount: dmg };
    }
    update(dt) {
        if (this.dead) return;
        let totalBleeding = 0;
        for (const key in this.parts) totalBleeding += this.parts[key].bleeding;
        if (totalBleeding > 0) { this.bloodLoss = Math.min(100, this.bloodLoss + totalBleeding * dt); if (this.bloodLoss >= 100) { this.dead = true; this.deathCause = 'кровопотеря'; return; } }
        this.pain = Math.max(0, this.pain - dt * 0.02);
    }
    accuracyPenalty() {
        let penalty = 1.0;
        for (const key in this.parts) {
            const p = this.parts[key], ratio = p.hp / p.maxHp, eff = BODY_PARTS[key].accuracy;
            if (ratio < 0.5) penalty -= eff * (1 - ratio / 0.5);
            if (p.hp <= 0 && !BODY_PARTS[key].vital) penalty -= eff;
        }
        penalty -= this.pain * 0.3; return Math.max(0.05, penalty);
    }
    speedPenalty() {
        let penalty = 1.0;
        for (const key in this.parts) {
            const p = this.parts[key], ratio = p.hp / p.maxHp, eff = BODY_PARTS[key].speed;
            if (ratio < 0.5) penalty -= eff * (1 - ratio / 0.5);
            if (p.hp <= 0 && !BODY_PARTS[key].vital) penalty -= eff;
        }
        penalty -= this.pain * 0.2; penalty -= this.bloodLoss * 0.003; return Math.max(0.1, penalty);
    }
    canShoot() { return this.parts.rightArm.hp > 0 || this.parts.leftArm.hp > 0; }
    canWalk() { return this.parts.leftLeg.hp > 0 || this.parts.rightLeg.hp > 0; }
    heal(part, amount) { const p = this.parts[part]; if (!p) return; p.hp = Math.min(p.maxHp, p.hp + amount); p.bleeding = Math.max(0, p.bleeding - amount * 0.5); }
    stopBleeding() { for (const key in this.parts) this.parts[key].bleeding = 0; }
    totalHp() { let sum = 0, max = 0; for (const key in this.parts) { sum += this.parts[key].hp; max += this.parts[key].maxHp; } return { current: sum, max }; }
}

class Radio {
    constructor(name, range) { this.name = name; this.range = range; this.jammed = false; this.members = []; this.jamChance = TACTICS.radio.jamChance; }
    add(u) { this.members.push(u); u.radio = this; }
    broadcast(sender, type, data) {
        if (this.jammed || Math.random() < this.jamChance) return;
        for (let i = 0; i < this.members.length; i++) {
            const u = this.members[i]; if (u === sender || u.dead || dist(u, sender) > this.range) continue;
            u.onReport(sender, type, data);
        }
    }
    reset() { this.jammed = false; this.members = []; }
}

// =============== VEHICLE ===============
class Vehicle {
    constructor({ x, y, team, type, name }) {
        this.x = x; this.y = y;
        this.team = team; this.type = type; this.name = name;
        
        const stats = VEHICLES[type];
        this.armor = stats.armor;
        this.speed = stats.speed * 0.2;
        this.maxSpeed = this.speed;
        
        this.facing = 0; this.turretAngle = 0; this.radius = 16;
        this.dead = false;
        this.isBurning = false;
        this.detonationTimer = 0;
        this.turretBroken = false;
        this.engineBroken = false;
        
        // Отсеки
        this.driver = null; this.gunner = null; this.passengers = [];
        
        // Управление
        this.moveTarget = null;
        this.target = null;
        this.cannonCooldown = 0;
    }

    canLoad() { return this.passengers.length < VEHICLES[this.type].troopCapacity; }
    loadPassenger(soldier) {
        if (!this.canLoad()) return false;
        soldier.inVehicle = this; this.passengers.push(soldier); return true;
    }
    unloadAll() {
        const backAngle = this.facing + Math.PI;
        for (const s of this.passengers) {
            s.inVehicle = null;
            s.x = this.x + Math.cos(backAngle) * (this.radius + 10) + (Math.random() - 0.5) * 15;
            s.y = this.y + Math.sin(backAngle) * (this.radius + 10) + (Math.random() - 0.5) * 15;
        }
        this.passengers = [];
    }

    takeHit(weapon, isRPG, hitX, hitY) {
        if (this.dead) return;
        const pen = isRPG ? 300 : (weapon ? weapon.penetration : 0);
        
        // 1. Проверка пробития
        if (pen < this.armor) {
            if (typeof GAME !== 'undefined') GAME.damageTexts.push({ x: this.x, y: this.y - 20, text: 'Рикошет', life: 0.5, color: '#aaa' });
            if (typeof Audio !== 'undefined') Audio.hit();
            return;
        }
        
        // 2. Определение модуля по углу
        const angleToHit = Math.atan2(hitY - this.y, hitX - this.x);
        let relativeAngle = angleToHit - this.facing;
        while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2;
        while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2;
        
        const absAngle = Math.abs(relativeAngle);
        
        if (absAngle > Math.PI * 0.75) { // Попадание в корму (десант)
            if (typeof GAME !== 'undefined') GAME.addReport(`💥 ${this.name}: пробита корма!`, '#ff4444');
            for (const s of this.passengers) {
                if (s.health) s.health.takeDamage(isRPG ? 100 : 30);
            }
            if (isRPG && Math.random() < 0.5) this.startFire(8);
        } else if (absAngle < Math.PI * 0.25) { // Попадание в лоб (двигатель у БМП-2)
            if (typeof GAME !== 'undefined') GAME.addReport(`🔥 ${this.name}: пробит двигатель!`, '#ff8800');
            this.engineBroken = true;
            this.speed = 0;
            if (isRPG) this.startFire(8);
        } else { // Попадание в борт (башня)
            if (typeof GAME !== 'undefined') GAME.addReport(`💥 ${this.name}: пробита башня!`, '#ff4444');
            this.turretBroken = true;
            if (this.gunner) this.gunner.health.takeDamage(50);
            if (isRPG && Math.random() < 0.3) this.detonate(); // 30% шанс детонации БК
        }
    }

    startFire(time) {
        if (this.isBurning) return;
        this.isBurning = true;
        this.detonationTimer = time;
        if (typeof Audio !== 'undefined') Audio.alarm();
    }

    detonate() {
        this.dead = true;
        if (typeof GAME !== 'undefined') {
            GAME.addReport(`💀 ${this.name}: ДЕТОНАЦИЯ БОЕКОМПЛЕКТА!`, '#ff0000');
            GAME.explosions.push({ x: this.x, y: this.y, radius: 30, life: 1.5 });
            if (typeof Audio !== 'undefined') Audio.explosion();
            GAME._screenShake = { x: 0, y: 0, time: 1.0 };
            GAME.allUnits.forEach(u => {
                if (u.dead) return;
                const d = dist(u, this);
                if (d < 25) u.health.takeDamage(100 * (1 - d/25));
            });
        }
        const everyoneInside = [this.driver, this.gunner, ...this.passengers].filter(Boolean);
        everyoneInside.forEach(s => { s.health.takeDamage(500); s.dead = true; });
        this.driver = null; this.gunner = null; this.passengers = [];
    }

    update(dt) {
        if (this.dead) return;
        
        if (this.detonationTimer > 0) {
            this.detonationTimer -= dt;
            if (this.detonationTimer <= 0) this.detonate();
        }
        
        if (this.cannonCooldown > 0) this.cannonCooldown -= dt;

        // Движение
        if (this.driver && !this.driver.dead && this.moveTarget && !this.engineBroken) {
            const dx = this.moveTarget.x - this.x, dy = this.moveTarget.y - this.y;
            const d = Math.hypot(dx, dy);
            if (d > 10) {
                const step = Math.min(d, this.speed * dt);
                this.x += (dx / d) * step; this.y += (dy / d) * step;
                this.facing = Math.atan2(dy, dx);
            } else this.moveTarget = null;
        }
        
        // Синхронизация экипажа
        if (this.driver) { this.driver.x = this.x; this.driver.y = this.y; }
        if (this.gunner) { this.gunner.x = this.x; this.gunner.y = this.y; }
        for (const p of this.passengers) { p.x = this.x; p.y = this.y; }
    }
}

// =============== SQUAD ===============
class Squad {
    constructor(team, name) {
        this.team = team; this.name = name;
        this.units = []; this.leader = null;
        this.radio = new Radio(`${team}_${name}`, TACTICS.radio.range);
        this.groups = {};
        this.phaseTimer = 0; this._firePos = null;
        this._manBounds = null; this._manBoundIndex = 0; this._usRoles = null;
    }
    addUnit(u) {
        this.units.push(u); this.radio.add(u);
        if (!this.groups[u.groupId]) this.groups[u.groupId] = [];
        this.groups[u.groupId].push(u);
        if (u.role === 'commander' || u.role === 'squad_leader') this.leader = u;
    }
    aliveUnits() { return this.units.filter(u => !u.dead); }
    aliveInGroup(gid) { return (this.groups[gid] || []).filter(u => !u.dead); }
}

// =============== SOLDIER ===============
class Soldier {
    constructor({ x, y, team, role, roleName, weaponId, groupId }) {
        this.x = x; this.y = y; this.team = team; this.role = role; this.roleName = roleName; this.groupId = groupId;
        this.weaponId = weaponId; this.weapon = WEAPONS[weaponId]; this.radius = TACTICS.soldierRadius;
        
        this.health = new Health();
        this.hp = 100; this.maxHp = 100; this.dead = false; this.deathTime = 0;
        this.inVehicle = null; // <--- Связь с машиной
        
        this.facing = 0; this.manualControl = false; this.moveTarget = null; this.formationSlot = null;
        this._hasActiveOrder = false; this.state = 'idle'; this.holding = false;
        
        this.stance = 'stand'; this.desiredStance = 'stand'; this.stanceTimer = 0; this.stanceLocked = false;
        this.target = null; this.cooldown = 0; this.muzzleFlash = 0;
        this.ammo = this.weapon.maxAmmo; this.glAmmo = this.weapon.glAmmo || 0;
        this.isReloading = false; this.reloadTimer = 0;
        
        this.aimTimer = 0; this.aimLevel = 0; this._lastX = x; this._lastY = y;
        this.suppressionLevel = 0; this.suppressionTimer = 0; this.recoveryTimer = 0;
        this._coverTarget = null; this.isSuppressing = false; this.suppressionTargetPos = null;
        
        this.morale = TACTICS.morale.max; this.combatStress = 0; this.moraleState = 'normal';
        this.panicTimer = 0; this._routingCover = null;
        
        this.radio = null; this.radioJamTimer = 0; this.pendingOrder = null; this.knownEnemies = [];
        this._lastReportTime = 0; this._reportedTarget = false; this._reportedFire = false; this._reportedAmmo = false;
        
        this.grenades = { frag: 2, smoke: 1 }; this.grenadeCooldown = 0; this.grenadeThrowTimer = 0;
        this.meleeCooldown = 0; this.smokeCooldown = 0;
    }

    // ... ВСЕ МЕТОДЫ СОЛДАТА ОСТАЮТСЯ ТАКИМИ ЖЕ (report, onReport, updateMorale, fireSuppression, hitChance, fire, throwGrenade, melee, moveTo, findEnemy) ...
    // Я не буду дублировать их, чтобы не раздувать ответ. Вставьте их сюда из предыдущей версии!
    // Ниже только те, что изменились:

    fire(allUnits) {
        if (this.dead || this.inVehicle || this.isReloading) return null;
        // ... остальной код fire() без изменений ...
        // В конце, если выстрел explosive:
        if (isExplosive) {
            // ... код урона по пехоте ...
            
            // ДОБАВИТЬ УРОН ПО ТЕХНИКЕ:
            if (typeof GAME !== 'undefined' && GAME.vehicles) {
                GAME.vehicles.forEach(v => {
                    if (v.dead || v.team === this.team) return;
                    if (Math.hypot(v.x - hitX, v.y - hitY) < v.radius + 5) {
                        v.takeHit(this.weapon, true, hitX, hitY);
                    }
                });
            }
        } else {
            // ... обычный урон ...
            // ДОБАВИТЬ УРОН ПО ТЕХНИКЕ:
            if (typeof GAME !== 'undefined' && GAME.vehicles) {
                GAME.vehicles.forEach(v => {
                    if (v.dead || v.team === this.team) return;
                    if (Math.hypot(v.x - tx, v.y - ty) < v.radius) {
                        v.takeHit(this.weapon, false, tx, ty);
                    }
                });
            }
        }
        // ...
    }
    
    // Остальные методы (autoSelectStance, setStance, moveTo, _tryMove, findEnemy) БЕЗ ИЗМЕНЕНИЙ.
    }
