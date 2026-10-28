// ==================== ENTITIES.JS ====================

const BODY_PARTS = {
    head:     { name: 'Голова', hp: 25, vital: true, accuracy: 0.20, speed: 0.10 },
    torso:    { name: 'Торс', hp: 40, vital: true, accuracy: 0.00, speed: 0.20 },
    leftArm:  { name: 'Левая рука', hp: 30, vital: false, accuracy: 0.30, speed: 0.00 },
    rightArm: { name: 'Правая рука', hp: 30, vital: false, accuracy: 0.30, speed: 0.00 },
    leftLeg:  { name: 'Левая нога', hp: 30, vital: false, accuracy: 0.00, speed: 0.30 },
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
        if (!Number.isFinite(amount) || amount <= 0) return { died: false, part: null, amount: 0 };
        let part = hitPart;
        if (!part) {
            let r = Math.random();
            for (const key in HIT_WEIGHTS) { r -= HIT_WEIGHTS[key]; if (r <= 0) { part = key; break; } }
            if (!part) part = 'torso';
        }
        const p = this.parts[part];
        if (!p) return { died: false, part: null, amount: 0 };
        const dmg = Math.max(0, amount);
        p.hp = Math.max(0, p.hp - dmg);
        p.bleeding += dmg * 0.3;
        this.pain = Math.min(1, this.pain + dmg / 200);
        if (BODY_PARTS[part].vital && p.hp <= 0) { this.dead = true; this.deathCause = part === 'head' ? 'голова' : 'торс'; return { died: true, part, amount: dmg }; }
        return { died: false, part, amount: dmg };
    }
    update(dt) {
        if (this.dead) return;
        if (!Number.isFinite(this.bloodLoss)) this.bloodLoss = 0;
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
        penalty -= this.pain * 0.3;
        return Math.max(0.05, penalty);
    }
    speedPenalty() {
        let penalty = 1.0;
        for (const key in this.parts) {
            const p = this.parts[key], ratio = p.hp / p.maxHp, eff = BODY_PARTS[key].speed;
            if (ratio < 0.5) penalty -= eff * (1 - ratio / 0.5);
            if (p.hp <= 0 && !BODY_PARTS[key].vital) penalty -= eff;
        }
        penalty -= this.pain * 0.2;
        penalty -= this.bloodLoss * 0.003;
        return Math.max(0.1, penalty);
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
            const u = this.members[i];
            if (u === sender || u.dead || dist(u, sender) > this.range) continue;
            u.onReport(sender, type, data);
        }
    }
    reset() { this.jammed = false; this.members = []; }
}

class Vehicle {
    constructor({ x, y, team, type, name }) {
        this.x = x; this.y = y; this.team = team; this.type = type; this.name = name;
        const stats = VEHICLES[type];
        this.armor = stats.hullArmor.front;
        this.speed = stats.speed * 0.2; this.maxSpeed = this.speed;
        this.facing = 0; this.turretAngle = 0; this.radius = 16; this.dead = false;
        this.isBurning = false; this.detonationTimer = 0; this.turretBroken = false; this.engineBroken = false;
        this.heat = 0; this.overheated = false;
        this.driver = null; this.gunner = null; this.passengers = [];
        this.moveTarget = null; this.target = null; this.cannonCooldown = 0;
    }
    canLoad() { return this.passengers.length < VEHICLES[this.type].troopCapacity; }
    loadPassenger(soldier) { if (!this.canLoad()) return false; soldier.inVehicle = this; this.passengers.push(soldier); return true; }
    unloadAll() {
        const backAngle = this.facing + Math.PI;
        for (const s of this.passengers) {
            s.inVehicle = null;
            s.x = this.x + Math.cos(backAngle) * (this.radius + 10) + (Math.random() - 0.5) * 15;
            s.y = this.y + Math.sin(backAngle) * (this.radius + 10) + (Math.random() - 0.5) * 15;
            s._lastX = s.x; s._lastY = s.y;
        }
        this.passengers = [];
    }
    takeHit(weapon, isRPG, hitX, hitY, shooterHeight = 1.7) {
        if (this.dead) return;
        const pen = isRPG ? 300 : (weapon ? weapon.penetration : 0);
        const stats = VEHICLES[this.type];
        const dx = hitX - this.x, dy = hitY - this.y;
        const distToCenter = Math.sqrt(dx * dx + dy * dy);
        const isHitTurret = distToCenter < this.radius * 0.6;
        const angleToHit = Math.atan2(dy, dx);
        let relativeAngle = angleToHit - this.facing;
        while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2;
        while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2;
        const absAngle = Math.abs(relativeAngle);
        let sector = 'side';
        if (absAngle < Math.PI / 4) sector = 'front';
        else if (absAngle > Math.PI * 0.75) sector = 'rear';
        const armorStats = isHitTurret ? stats.turretArmor : stats.hullArmor;
        const slopeStats = isHitTurret ? stats.turretSlope : stats.hullSlope;
        let baseArmor = armorStats[sector];
        let effectiveArmor = baseArmor;
        if (!isRPG) {
            const slopeAngle = slopeStats[sector];
            const effectiveSlope = slopeAngle + (absAngle * 180 / Math.PI);
            const rad = effectiveSlope * Math.PI / 180;
            if (rad < Math.PI / 2) effectiveArmor = baseArmor / Math.cos(rad);
        }
        if (pen < effectiveArmor) {
            if (typeof GAME !== 'undefined') GAME.damageTexts.push({ x: this.x, y: this.y - 20, text: isRPG ? 'Не пробил!' : 'Рикошет', life: 0.5, color: '#aaa' });
            if (typeof Audio !== 'undefined') Audio.hit();
            return;
        }
        if (typeof GAME !== 'undefined') GAME.addReport(`💥 ${this.name}: пробита ${isHitTurret ? 'башня' : 'корпус'}!`, '#ff4444');
        if (isHitTurret) {
            this.turretBroken = true;
            if (this.gunner) {
                this.gunner.health.takeDamage(isRPG ? 150 : 50);
                this.gunner.inVehicle = null;
                this.gunner = null;
                if (typeof GAME !== 'undefined') GAME.addReport(`💀 ${this.name}: наводчик выведен из строя!`, '#ff4444');
            }
            if (isRPG && Math.random() < 0.4) this.detonate();
        } else {
            if (sector === 'front') {
                this.engineBroken = true; this.speed = 0;
                if (this.driver) {
                    this.driver.inVehicle = null;
                    this.driver = null;
                    if (typeof GAME !== 'undefined') GAME.addReport(`💀 ${this.name}: механик-водитель выведен!`, '#ff4444');
                }
                if (isRPG) this.startFire(8);
            } else if (sector === 'rear') {
                for (const s of this.passengers) if (s.health) s.health.takeDamage(isRPG ? 100 : 30);
                if (isRPG && Math.random() < 0.5) this.startFire(8);
            } else {
                if (isRPG) {
                    if (this.driver) this.driver.health.takeDamage(100);
                    for (const s of this.passengers) if (s.health) s.health.takeDamage(100);
                    this.startFire(8);
                }
            }
        }
    }
    startFire(time) { if (this.isBurning) return; this.isBurning = true; this.detonationTimer = time; if (typeof Audio !== 'undefined') Audio.alarm(); }
    detonate() {
        this.dead = true;
        const G = (typeof GAME !== 'undefined') ? GAME : null;
        if (G) {
            G.addReport(`💀 ${this.name}: ДЕТОНАЦИЯ БОЕКОМПЛЕКТА!`, '#ff0000');
            G.explosions.push({ x: this.x, y: this.y, radius: 30, life: 1.5 });
            if (typeof Audio !== 'undefined') Audio.explosion();
            G._screenShake = { x: 0, y: 0, time: 1.0 };
            for (let i = 0; i < G.allUnits.length; i++) {
                const u = G.allUnits[i];
                if (u.dead) continue;
                const d = dist(u, this);
                if (d < 25) u.health.takeDamage(100 * (1 - d / 25));
            }
        }
        const everyoneInside = [this.driver, this.gunner, ...this.passengers].filter(Boolean);
        everyoneInside.forEach(s => { s.health.takeDamage(500); s.dead = true; });
        this.driver = null; this.gunner = null; this.passengers = [];
    }
    update(dt) {
        if (this.dead) return;
        if (this.detonationTimer > 0) { this.detonationTimer -= dt; if (this.detonationTimer <= 0) this.detonate(); }
        if (this.cannonCooldown > 0) this.cannonCooldown -= dt;
        if (this.heat > 0 && !this.overheated) this.heat -= dt * 5;
        if (this.overheated && this.heat <= 0) { this.overheated = false; this.heat = 0; }
        if (this.driver && !this.driver.dead && this.moveTarget && !this.engineBroken) {
            const dx = this.moveTarget.x - this.x, dy = this.moveTarget.y - this.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > 10) { const step = Math.min(d, this.speed * dt); this.x += (dx / d) * step; this.y += (dy / d) * step; this.facing = Math.atan2(dy, dx); }
            else this.moveTarget = null;
        }
        if (this.driver && !this.driver.dead) { this.driver.x = this.x; this.driver.y = this.y; }
        if (this.gunner && !this.gunner.dead) { this.gunner.x = this.x; this.gunner.y = this.y; }
        for (const p of this.passengers) { if (!p.dead) { p.x = this.x; p.y = this.y; } }
    }
}

class Squad {
    constructor(team, name) {
        this.team = team; this.name = name; this.units = []; this.leader = null;
        this.radio = new Radio(`${team}_${name}`, TACTICS.radio.range);
        this.groups = {}; this.phaseTimer = 0; this._firePos = null; this._manBounds = null; this._manBoundIndex = 0; this._usRoles = null;
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

class Soldier {
    constructor({ x, y, team, role, roleName, weaponId, groupId }) {
        this.x = x; this.y = y; this.team = team; this.role = role; this.roleName = roleName; this.groupId = groupId;
        this.weaponId = weaponId; this.weapon = WEAPONS[weaponId]; this.radius = TACTICS.soldierRadius;
        this.health = new Health(); this.hp = 100; this.maxHp = 100; this.dead = false; this.deathTime = 0; this.inVehicle = null;
        this.facing = 0; this.manualControl = false; this.moveTarget = null; this.formationSlot = null; this._hasActiveOrder = false; this.state = 'idle'; this.holding = false;
        this.stance = 'stand'; this.desiredStance = 'stand'; this.stanceTimer = 0; this.stanceLocked = false;
        this.target = null; this.cooldown = 0; this.muzzleFlash = 0; this.ammo = this.weapon.maxAmmo; this.glAmmo = this.weapon.glAmmo || 0;
        this.magazines = Math.floor(this.weapon.maxAmmo / this.weapon.magSize);
        this.isReloading = false; this.reloadTimer = 0;
        this.aimTimer = 0; this.aimLevel = 0; this._lastX = x; this._lastY = y; this.suppressionLevel = 0; this.suppressionTimer = 0; this.recoveryTimer = 0;
        this._coverTarget = null; this.isSuppressing = false; this.suppressionTargetPos = null; this.morale = TACTICS.morale.max; this.combatStress = 0; this.moraleState = 'normal'; this.panicTimer = 0; this._routingCover = null;
        this.radio = null; this.radioJamTimer = 0; this.pendingOrder = null; this.knownEnemies = []; this._lastReportTime = 0; this._reportedTarget = false; this._reportedFire = false; this._reportedAmmo = false;
        this.grenades = { frag: 2, smoke: 1 }; this.grenadeCooldown = 0; this.grenadeThrowTimer = 0; this.meleeCooldown = 0; this.smokeCooldown = 0;
        this.stamina = TACTICS.stamina.max;
        this.totalWeight = this.calculateWeight();
        this.heat = 0;
        this.isJammed = false;
        this.jamTimer = 0;
        this.followTarget = null;
    }

    calculateWeight() {
        let w = TACTICS.weight.baseEquipment;
        w += this.weapon.weight || 0;
        w += this.ammo * TACTICS.weight.ammoWeight;
        w += this.magazines * this.weapon.magSize * TACTICS.weight.ammoWeight;
        w += this.grenades.frag * TACTICS.weight.grenadeWeight;
        w += this.grenades.smoke * TACTICS.weight.smokeWeight;
        return w;
    }

    report(type, data) {
        if (!this.radio || this.dead || this.radioJamTimer > 0) return;
        const now = performance.now();
        if (now - this._lastReportTime < TACTICS.radio.reportCooldown * 1000) return;
        this._lastReportTime = now;
        this.radio.broadcast(this, type, data);
    }
    onReport(sender, type, data) {
        if (this.radioJamTimer > 0) return;
        if (type === 'enemy_spotted') {
            const existing = this.knownEnemies.find(e => { const dx = e.x - data.x, dy = e.y - data.y; return (dx * dx + dy * dy) < 400; });
            if (existing) existing.time = performance.now();
            else this.knownEnemies.push({ x: data.x, y: data.y, time: performance.now() });
        } else if (type === 'taking_fire') { this.morale = Math.max(0, this.morale - 3); this.combatStress = Math.min(100, this.combatStress + 5); }
        else if (type === 'ammo_low') this._needResupply = true;
    }
    updateMorale(dt, allUnits) {
        if (this.dead) return;
        const M = TACTICS.morale;
        const hpTotal = this.health.totalHp();
        const hpRatio = hpTotal.current / hpTotal.max;
        if (hpRatio < 0.5) this.morale -= M.decayWounded * dt;
        if (this.suppressionLevel > 40) this.morale -= M.decaySuppression * dt;
        let enemyNear = false;
        for (let i = 0; i < allUnits.length; i++) {
            const u = allUnits[i];
            if (!u.dead && u.team !== this.team && dist(u, this) < TACTICS.viewRange) { enemyNear = true; break; }
        }
        if (enemyNear) this.combatStress = Math.min(100, this.combatStress + M.stressGain * dt);
        else this.combatStress = Math.max(0, this.combatStress - M.stressDecay * dt);
        if (this.combatStress > M.stressThreshold) { const excess = (this.combatStress - M.stressThreshold) / 40; this.morale -= (M.decayStress + excess * 2) * dt; }
        if (this.morale < M.max) {
            let regen = M.regenBase * dt;
            let leaderNearby = false;
            for (let i = 0; i < allUnits.length; i++) {
                const u = allUnits[i];
                if (!u.dead && u.team === this.team && (u.role === 'commander' || u.role === 'squad_leader') && dist(u, this) < M.leaderRadius) { leaderNearby = true; break; }
            }
            if (leaderNearby) regen *= M.regenLeader;
            if (this.suppressionLevel < 10) regen *= M.regenCalm;
            this.morale = Math.min(M.max, this.morale + regen);
        }
        this.morale = Math.max(0, Math.min(M.max, this.morale));
        const T = M.thresholds;
        if (this.morale < T.surrendered) this.moraleState = 'surrendered';
        else if (this.morale < T.routing) this.moraleState = 'routing';
        else if (this.morale < T.panicked) this.moraleState = 'panicked';
        else if (this.morale < T.cautious) this.moraleState = 'cautious';
        else this.moraleState = 'normal';
    }
    fireSuppression(allUnits) {
        if (this.dead || this.inVehicle || this.stance !== this.desiredStance || !this.health.canShoot() || this.isJammed || this.isReloading) return null;
        if (this.ammo <= 0) { this.isReloading = true; this.reloadTimer = this.weapon.reloadTime; this.isSuppressing = false; return null; }
        this.heat += this.weapon.heatRate;
        if (this.heat >= this.weapon.heatMax) { this.isJammed = true; this.jamTimer = 5.0; this.heat = 0; if (typeof GAME !== 'undefined') GAME.showStatus(`🔥 ${this.roleName}: оружие перегрелось!`); return null; }
        this.ammo--; this.cooldown = this.weapon.fireRate; this.muzzleFlash = 0.06;
        const tx = this.suppressionTargetPos.x + (Math.random() - 0.5) * 25, ty = this.suppressionTargetPos.y + (Math.random() - 0.5) * 25;
        for (let i = 0; i < allUnits.length; i++) {
            const u = allUnits[i];
            if (u.dead || u.team === this.team) continue;
            const dx = u.x - tx, dy = u.y - ty;
            const d = Math.sqrt(dx * dx + dy * dy);
            const area = TACTICS.suppressionRadius * TACTICS.suppressionMGMult;
            if (d < area) u.applySuppression((1 - d / area) * this.weapon.suppressionPower);
        }
        return { x: this.x, y: this.y, tx, ty };
    }
    applySuppression(intensity) {
        if (this.dead) return;
        this.suppressionLevel = Math.min(100, this.suppressionLevel + 25 * intensity);
        this.suppressionTimer = Math.max(this.suppressionTimer, 1.5);
        this.aimTimer = 0;
        if (this.suppressionLevel > 40) { this.setStance('prone'); this.moveTarget = null; }
    }
    hitChance(target) {
        if (this.dead || target.dead || !this.health.canShoot()) return 0;
        const d = dist(this, target), w = this.weapon; let chance = w.accuracy;
        const obstacles = (typeof GAME !== 'undefined' && GAME.obstacles) ? GAME.obstacles : [];
        if (rayBlocked(this.x, this.y, target.x, target.y, obstacles)) return TACTICS.hitChanceMin;
        if (!isInViewCone(this, target, TACTICS.viewCone)) return 0;
        if (typeof GAME !== 'undefined' && GAME.smokes && GAME.smokes.length > 0) {
            for (const s of GAME.smokes) {
                const sdx = target.x - s.x, sdy = target.y - s.y;
                if (Math.sqrt(sdx * sdx + sdy * sdy) < s.radius) { chance *= 0.3; break; }
            }
        }
        if (d <= w.effRange) chance *= (1 - Math.pow(d / w.effRange, 2) * 0.25);
        else if (d <= w.maxRange) { const over = (d - w.effRange) / (w.maxRange - w.effRange); chance *= (0.75 - over * 0.65); } else return 0;
        chance *= STANCES[this.stance].hitMod;
        chance *= STANCES[target.stance].targetSize;
        if (this.state === 'moving') chance *= TACTICS.movingPenalty;
        if (this.stance !== this.desiredStance) chance *= TACTICS.stanceSwitchPenalty;
        if (w.bipod && this.stance === 'prone' && this.state !== 'moving') chance *= TACTICS.bipodBonus;
        if (target.currentObstacle) chance *= 0.5;
        if (this.suppressionLevel > 40) chance *= TACTICS.suppressionAccuracyPenalty;
        else if (this.recoveryTimer > 0) chance *= 0.7;
        chance *= this.health.accuracyPenalty();
        chance *= Weather.accuracyMult();
        if (this.stamina < TACTICS.stamina.tiredThreshold) chance *= 0.5;
        if (this.moraleState === 'surrendered') return 0;
        if (this.moraleState === 'routing') chance *= 0.1;
        else if (this.moraleState === 'panicked') chance *= 0.4;
        else if (this.moraleState === 'cautious') chance *= 0.7;
        let aimBonus = TACTICS.aimBonus.standard;
        if (this.weaponId === 'm110') aimBonus = TACTICS.aimBonus.sniper;
        else if (this.role === 'mg' && this.stance === 'prone') aimBonus = TACTICS.aimBonus.mg;
        chance *= (1 + this.aimLevel * aimBonus);
        return Math.max(TACTICS.hitChanceMin, Math.min(TACTICS.hitChanceMax, chance));
    }
    fire(allUnits) {
        if (this.dead || this.isReloading || this.inVehicle || this.moraleState === 'surrendered' || this.moraleState === 'routing' || this.stance !== this.desiredStance || !this.health.canShoot() || this.isJammed) return null;
        this.heat += this.weapon.heatRate;
        if (this.heat >= this.weapon.heatMax) { this.isJammed = true; this.jamTimer = 5.0; this.heat = 0; if (typeof GAME !== 'undefined') GAME.showStatus(`🔥 ${this.roleName}: оружие перегрелось!`); return null; }
        const isGL = this.weapon.hasGL && Math.random() < 0.3;
        if (isGL && this.glAmmo <= 0) return null;
        if (!isGL && this.ammo <= 0) {
            if (this.magazines > 0) { this.ammo = this.weapon.magSize; this.magazines--; }
            this.isReloading = true; this.reloadTimer = 5.0; this.aimTimer = 0; return null;
        }
        if (isGL) this.glAmmo--; else this.ammo--;
        this.cooldown = this.weapon.fireRate; this.muzzleFlash = 0.06;
        const t = this.target; if (!t || t.dead) return null;
        if (!this._reportedAmmo && this.ammo < this.weapon.magSize) { this.report('ammo_low', { ammo: this.ammo }); this._reportedAmmo = true; }
        const isExplosive = this.weapon.isAntiTank || isGL;
        if (isExplosive) {
            const blastRadius = isGL ? this.weapon.glBlast : this.weapon.blastRadius;
            let hitX = t.x, hitY = t.y;
            if (this.weapon.isAntiTank) { hitX += (Math.random() - 0.5) * 15; hitY += (Math.random() - 0.5) * 15; }
            const d = dist(this, t);
            if (d > this.weapon.effRange) { const scatter = (d - this.weapon.effRange) / 2; hitX += (Math.random() - 0.5) * scatter; hitY += (Math.random() - 0.5) * scatter; }
            const G = (typeof GAME !== 'undefined') ? GAME : null;
            for (let i = 0; i < allUnits.length; i++) {
                const u = allUnits[i];
                if (u.dead || u.team === this.team) continue;
                const ddx = u.x - hitX, ddy = u.y - hitY;
                const dd = Math.sqrt(ddx * ddx + ddy * ddy);
                if (dd < blastRadius) {
                    const falloff = 1 - dd / blastRadius;
                    const dmg = (isGL ? 80 : (this.weapon.isAntiTank ? 100 : this.weapon.damage)) * falloff;
                    const result = u.health.takeDamage(dmg); u._showDamage(dmg, result.part);
                    if (result.died || u.health.dead) { u.hp = 0; u.dead = true; u.deathTime = performance.now(); this._notifyDeath(u, allUnits); }
                }
                if (dd < blastRadius * 2) u.applySuppression((1 - dd / (blastRadius * 2)) * 1.5 * this.weapon.suppressionPower);
            }
            if (G && G.vehicles) {
                for (let i = 0; i < G.vehicles.length; i++) {
                    const v = G.vehicles[i];
                    if (v.dead || v.team === this.team) continue;
                    if (Math.hypot(v.x - hitX, v.y - hitY) < v.radius + 5) v.takeHit(this.weapon, true, hitX, hitY, 1.7);
                }
            }
            return { type: 'explosion', x: hitX, y: hitY, radius: blastRadius, weaponId: this.weaponId };
        }
        let tx = t.x, ty = t.y;
        const drop = applyBulletDrop(tx, ty, dist(this, t), this.weapon);
        let finalTx = drop.tx + (Math.random() - 0.5) * 60;
        let finalTy = drop.ty + (Math.random() - 0.5) * 60;
        const obstacles = (typeof GAME !== 'undefined' && GAME.obstacles) ? GAME.obstacles : [];
        const ric = calculateRicochet(finalTx, finalTy, t.x, t.y, obstacles);
        if (ric) { finalTx = ric.x; finalTy = ric.y; if (typeof GAME !== 'undefined') GAME.addReport(`💥 Рикошет!`, '#aaa'); }
        const hit = Math.random() < this.hitChance(t);
        if (hit) {
            const variance = TACTICS.damageVariance;
            const dmg = this.weapon.damage * (1 - variance + Math.random() * variance * 2);
            const result = t.health.takeDamage(dmg); t._showDamage(dmg, result.part);
            if (!t._reportedFire) { t.report('taking_fire', { from: { x: this.x, y: this.y } }); t._reportedFire = true; }
            if (result.died || t.health.dead) { t.hp = 0; t.dead = true; t.deathTime = performance.now(); this._notifyDeath(t, allUnits); }
        }
        const isMG = this.weaponId === 'pkm' || this.weaponId === 'm249';
        const suppRadius = isMG ? TACTICS.suppressionRadius * TACTICS.suppressionMGMult : TACTICS.suppressionRadius;
        for (let i = 0; i < allUnits.length; i++) {
            const u = allUnits[i];
            if (u.dead || u.team === this.team || u === t) continue;
            const dLine = this._distToLine(u.x, u.y, this.x, this.y, finalTx, finalTy);
            if (dLine < suppRadius) u.applySuppression((1 - dLine / suppRadius) * this.weapon.suppressionPower);
        }
        if (typeof GAME !== 'undefined' && GAME.vehicles) {
            for (let i = 0; i < GAME.vehicles.length; i++) {
                const v = GAME.vehicles[i];
                if (v.dead || v.team === this.team) continue;
                if (Math.hypot(v.x - finalTx, v.y - finalTy) < v.radius) v.takeHit(this.weapon, false, finalTx, finalTy, 1.7);
            }
        }
        return { type: 'bullet', x: this.x, y: this.y, tx: finalTx, ty: finalTy, team: this.team, isMG, weaponId: this.weaponId };
    }
    throwGrenade(target, type = 'frag') {
        if (this.dead || this.health.dead || this.grenadeCooldown > 0 || !target || target.dead) return null;
        const d = dist(this, target);
        if (d < TACTICS.grenade.minRange || d > TACTICS.grenade.maxRange) return null;
        const obstacles = (typeof GAME !== 'undefined' && GAME.obstacles) ? GAME.obstacles : [];
        if (rayBlocked(this.x, this.y, target.x, target.y, obstacles)) return null;
        if (type === 'frag' && this.grenades.frag <= 0) type = 'smoke';
        if (type === 'smoke' && this.grenades.smoke <= 0) type = 'frag';
        if (this.grenades[type] <= 0) return null;
        this.grenades[type]--; this.grenadeCooldown = TACTICS.grenade.cooldown; this.grenadeThrowTimer = TACTICS.grenade.throwTime; this.facing = Math.atan2(target.y - this.y, target.x - this.x);
        const scatter = d > 20 ? 3 : 1.5;
        const hitX = target.x + (Math.random() - 0.5) * scatter;
        const hitY = target.y + (Math.random() - 0.5) * scatter;
        return { type: 'grenade', grenadeType: type, x: this.x, y: this.y, tx: hitX, ty: hitY, fuse: TACTICS.grenade.fuseTime || 2.0, thrower: this, weaponId: this.weaponId };
    }
    melee(target) {
        if (this.dead || this.health.dead || this.meleeCooldown > 0 || !target || target.dead || dist(this, target) > TACTICS.melee.range) return null;
        this.meleeCooldown = TACTICS.melee.cooldown; this.facing = Math.atan2(target.y - this.y, target.x - this.x);
        const hit = Math.random() < TACTICS.melee.accuracy;
        if (hit) {
            const dmg = TACTICS.melee.damage * (0.8 + Math.random() * 0.4);
            const result = target.health.takeDamage(dmg, 'torso'); target._showDamage(dmg, result.part);
            if (result.died || target.health.dead) { target.hp = 0; target.dead = true; target.deathTime = performance.now(); this._notifyDeath(target, GAME.allUnits); }
            return { type: 'melee', x: this.x, y: this.y, tx: target.x, ty: target.y, hit: true };
        }
        return { type: 'melee', x: this.x, y: this.y, tx: target.x, ty: target.y, hit: false };
    }
    _notifyDeath(deadUnit, allUnits) {
        this.report('man_down', { role: deadUnit.roleName });
        for (let i = 0; i < allUnits.length; i++) {
            const ally = allUnits[i];
            if (ally.dead || ally.team !== deadUnit.team || ally === deadUnit) continue;
            if (dist(ally, deadUnit) < TACTICS.morale.allyDeathRadius) {
                ally.morale = Math.max(0, ally.morale - TACTICS.morale.decayAllyDeath);
                ally.combatStress = Math.min(100, ally.combatStress + 10);
            }
        }
        if (typeof Audio !== 'undefined') Audio.death();
    }
    _showDamage(dmg, part) {
        if (typeof GAME !== 'undefined' && GAME.damageTexts) {
            const partName = part ? BODY_PARTS[part].name : '';
            GAME.damageTexts.push({ x: this.x, y: this.y - 10, text: `-${Math.round(dmg)}${partName ? ' ' + partName : ''}`, life: 1.0, color: '#ff4444' });
        }
    }
    _distToLine(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.01) { const ddx = px - x1, ddy = py - y1; return Math.sqrt(ddx * ddx + ddy * ddy); }
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (len * len)));
        const ddx = px - (x1 + t * dx), ddy = py - (y1 + t * dy);
        return Math.sqrt(ddx * ddx + ddy * ddy);
    }
    autoSelectStance() {
        if (this.dead || this.inVehicle || this.suppressionLevel > 40 || this.stanceLocked) return;
        const isMoving = this.state === 'moving', inCombat = this.target && dist(this, this.target) <= this.weapon.maxRange;
        if (isMoving) {
            if (this.stamina < TACTICS.stamina.tiredThreshold || this.totalWeight > TACTICS.weight.limit) this.setStance('stand');
            else this.setStance('run');
        }
        else if (inCombat) { if (this.weaponId === 'rpg7') this.setStance('crouch'); else if (this.weaponId === 'm110' || this.role === 'mg') this.setStance('prone'); else this.setStance('crouch'); }
        else if (this.holding) this.setStance('crouch');
        else this.setStance('stand');
        if (this.moraleState === 'cautious' && this.state !== 'moving') this.setStance('crouch');
        if (!this.health.canWalk()) this.setStance('prone');
    }
    setStance(stance) { if (this.stance === stance || this.desiredStance === stance) return; this.desiredStance = stance; this.stanceTimer = TACTICS.stanceSwitchTime; this.aimTimer = 0; }
    moveTo(tx, ty, dt, obstacles) {
        const dx = tx - this.x, dy = ty - this.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 2) return true;
        let speedBase = STANCES[this.stance].speed;
        if (this.stamina < TACTICS.stamina.tiredThreshold || this.totalWeight > TACTICS.weight.limit) speedBase = STANCES.stand.speed;
        const healthSpeed = this.health.speedPenalty();
        const spd = speedBase * healthSpeed * Weather.speedMult(), step = Math.min(d, spd * dt);
        if (!this.health.canWalk()) { this._tryMove(dx, dy, d, step * 0.35, obstacles); return false; }
        this._tryMove(dx, dy, d, step, obstacles); return false;
    }
    _tryMove(dx, dy, d, step, obstacles) {
        const baseAngle = Math.atan2(dy, dx);
        const primary = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2];
        const fallback = [3 * Math.PI / 4, -3 * Math.PI / 4, Math.PI];
        for (let i = 0; i < primary.length; i++) {
            const angle = baseAngle + primary[i];
            const nx = this.x + Math.cos(angle) * step, ny = this.y + Math.sin(angle) * step;
            const cx = Math.max(4, Math.min(WORLD.width - 4, nx)), cy = Math.max(4, Math.min(WORLD.height - 4, ny));
            if (!pointInAnyObstacle(cx, cy, obstacles, ['tree', 'bush'])) { this.x = cx; this.y = cy; if (primary[i] === 0) this.facing = baseAngle; return; }
        }
        for (let i = 0; i < fallback.length; i++) {
            const angle = baseAngle + fallback[i];
            const nx = this.x + Math.cos(angle) * step, ny = this.y + Math.sin(angle) * step;
            const cx = Math.max(4, Math.min(WORLD.width - 4, nx)), cy = Math.max(4, Math.min(WORLD.height - 4, ny));
            if (!pointInAnyObstacle(cx, cy, obstacles, ['tree', 'bush'])) { this.x = cx; this.y = cy; return; }
        }
    }
    findEnemy(allUnits, obstacles, mapType, spatialHash) {
        let best = null, bestScore = -Infinity;
        const viewRange = (mapType === 'forest' ? TACTICS.viewRange * 0.7 : TACTICS.viewRange) * Weather.viewRangeMult();
        const candidates = spatialHash ? spatialHash.queryRadius(this.x, this.y, viewRange) : allUnits;
        const P = TACTICS.targetPriority;
        for (let i = 0; i < candidates.length; i++) {
            const u = candidates[i];
            if (u.dead || u.team === this.team) continue;
            const dx = u.x - this.x, dy = u.y - this.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > viewRange) continue;
            if (!isInViewCone(this, u, TACTICS.viewCone)) continue;
            if (rayBlocked(this.x, this.y, u.x, u.y, obstacles)) continue;
            const roleWeight = P.roleWeight[u.role] || 1;
            const distScore = P.distanceWeight * (100 - d) / 100;
            const angleTo = Math.atan2(dy, dx);
            let angleDiff = Math.abs(angleTo - this.facing);
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
            const frontScore = P.frontWeight * (1 - angleDiff / Math.PI);
            const coverScore = u.currentObstacle ? -P.coverWeight : 0;
            const uHp = u.health.totalHp();
            const woundedScore = uHp.current / uHp.max < 0.5 ? -P.woundedWeight : 0;
            let threatScore = 0;
            if (u.role === 'mg' && d > 200) threatScore = 0.5;
            else if (u.role === 'grenadier' && d < 100) threatScore = 0.7;
            else if (u.role === 'commander' || u.role === 'squad_leader') threatScore = 0.3;
            const score = roleWeight * 10 + distScore + frontScore * 5 + coverScore * 3 + woundedScore * 2 + threatScore * 5;
            if (score > bestScore) { bestScore = score; best = u; }
        }
        return best;
    }
                        }
