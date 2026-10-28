// ==================== ENTITIES.JS ====================

// ---------- Утилиты ----------
function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }

function pointInRect(x, y, rect, padding = 0) {
    return x > rect.x - rect.w / 2 - padding &&
           x < rect.x + rect.w / 2 + padding &&
           y > rect.y - rect.h / 2 - padding &&
           y < rect.y + rect.h / 2 + padding;
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

// ---------- Health (RimWorld) ----------
const BODY_PARTS = {
    head:     { name: 'Голова',      hp: 25, vital: true,  accuracy: 0.20, speed: 0.10 },
    torso:    { name: 'Торс',        hp: 40, vital: true,  accuracy: 0.00, speed: 0.20 },
    leftArm:  { name: 'Левая рука',  hp: 30, vital: false, accuracy: 0.30, speed: 0.00 },
    rightArm: { name: 'Правая рука', hp: 30, vital: false, accuracy: 0.30, speed: 0.00 },
    leftLeg:  { name: 'Левая нога',  hp: 30, vital: false, accuracy: 0.00, speed: 0.30 },
    rightLeg: { name: 'Правая нога', hp: 30, vital: false, accuracy: 0.00, speed: 0.30 }
};

const HIT_WEIGHTS = {
    head: 0.08, torso: 0.42, leftArm: 0.12, rightArm: 0.12, leftLeg: 0.13, rightLeg: 0.13
};

class Health {
    constructor() {
        this.parts = {};
        for (const key in BODY_PARTS) {
            this.parts[key] = { hp: BODY_PARTS[key].hp, maxHp: BODY_PARTS[key].hp, bleeding: 0 };
        }
        this.bloodLoss = 0;
        this.pain = 0;
        this.infected = false;
        this.dead = false;
        this.deathCause = null;
    }
    takeDamage(amount, hitPart = null) {
        if (this.dead) return { died: false, part: null, amount: 0 };
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
        const dmg = Math.max(0, amount);
        p.hp = Math.max(0, p.hp - dmg);
        p.bleeding += dmg * 0.3;
        this.pain = Math.min(1, this.pain + dmg / 200);
        const vital = BODY_PARTS[part].vital;
        if (vital && p.hp <= 0) {
            this.dead = true;
            this.deathCause = part === 'head' ? 'голова' : 'торс';
            return { died: true, part, amount: dmg };
        }
        return { died: false, part, amount: dmg };
    }
    update(dt) {
        if (this.dead) return;
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
        this.pain = Math.max(0, this.pain - dt * 0.02);
    }
    accuracyPenalty() {
        let penalty = 1.0;
        for (const key in this.parts) {
            const p = this.parts[key];
            const ratio = p.hp / p.maxHp;
            const eff = BODY_PARTS[key].accuracy;
            if (ratio < 0.5) penalty -= eff * (1 - ratio / 0.5);
            if (p.hp <= 0 && !BODY_PARTS[key].vital) penalty -= eff;
        }
        penalty -= this.pain * 0.3;
        return Math.max(0.05, penalty);
    }
    speedPenalty() {
        let penalty = 1.0;
        for (const key in this.parts) {
            const p = this.parts[key];
            const ratio = p.hp / p.maxHp;
            const eff = BODY_PARTS[key].speed;
            if (ratio < 0.5) penalty -= eff * (1 - ratio / 0.5);
            if (p.hp <= 0 && !BODY_PARTS[key].vital) penalty -= eff;
        }
        penalty -= this.pain * 0.2;
        penalty -= this.bloodLoss * 0.003;
        return Math.max(0.1, penalty);
    }
    canShoot() { return this.parts.rightArm.hp > 0 || this.parts.leftArm.hp > 0; }
    canWalk() { return this.parts.leftLeg.hp > 0 || this.parts.rightLeg.hp > 0; }
    heal(part, amount) {
        const p = this.parts[part];
        if (!p) return;
        p.hp = Math.min(p.maxHp, p.hp + amount);
        p.bleeding = Math.max(0, p.bleeding - amount * 0.5);
    }
    stopBleeding() { for (const key in this.parts) this.parts[key].bleeding = 0; }
    totalHp() {
        let sum = 0, max = 0;
        for (const key in this.parts) { sum += this.parts[key].hp; max += this.parts[key].maxHp; }
        return { current: sum, max };
    }
}

// ---------- Radio ----------
class Radio {
    constructor(name, range) {
        this.name = name;
        this.range = range;
        this.jammed = false;
        this.members = [];
        this.jamChance = TACTICS.radio.jamChance;
    }
    add(u) { this.members.push(u); u.radio = this; }
    broadcast(sender, type, data) {
        if (this.jammed) return;
        if (Math.random() < this.jamChance) return;
        for (let i = 0; i < this.members.length; i++) {
            const u = this.members[i];
            if (u === sender || u.dead) continue;
            if (dist(u, sender) > this.range) continue;
            u.onReport(sender, type, data);
        }
    }
    reset() { this.jammed = false; this.members = []; }
}

// ---------- Squad (ДОБАВЛЕНО! ЭТОГО НЕ ХВАТАЛО) ----------
class Squad {
    constructor(team, name) {
        this.team = team;
        this.name = name;
        this.units = [];
        this.leader = null;
        this.radio = new Radio(`${team}_${name}`, TACTICS.radio.range);
        this.groups = {};
        this.phaseTimer = 0;
        this._firePos = null;
        this._manBounds = null;
        this._manBoundIndex = 0;
        this._usRoles = null;
    }
    
    addUnit(u) {
        this.units.push(u);
        this.radio.add(u);
        if (!this.groups[u.groupId]) this.groups[u.groupId] = [];
        this.groups[u.groupId].push(u);
        if (u.role === 'commander' || u.role === 'squad_leader') this.leader = u;
    }
    
    aliveUnits() { 
        return this.units.filter(u => !u.dead); 
    }
    
    aliveInGroup(gid) { 
        return (this.groups[gid] || []).filter(u => !u.dead); 
    }
}

// ---------- Soldier ----------
class Soldier {
    constructor({ x, y, team, role, roleName, weaponId, groupId }) {
        this.x = x; this.y = y;
        this.team = team;
        this.role = role;
        this.roleName = roleName;
        this.groupId = groupId;
        this.weaponId = weaponId;
        this.weapon = WEAPONS[weaponId];
        this.radius = TACTICS.soldierRadius;
        
        this.health = new Health();
        this.hp = 100;
        this.maxHp = 100;
        this.dead = false;
        this.deathTime = 0;
        
        this.facing = 0;
        this.manualControl = false;
        this.moveTarget = null;
        this.formationSlot = null;
        this._hasActiveOrder = false;
        this.state = 'idle';
        this.holding = false;
        
        this.stance = 'stand';
        this.desiredStance = 'stand';
        this.stanceTimer = 0;
        this.stanceLocked = false;
        
        this.target = null;
        this.cooldown = 0;
        this.muzzleFlash = 0;
        this.ammo = this.weapon.maxAmmo;
        this.glAmmo = this.weapon.glAmmo || 0;
        this.isReloading = false;
        this.reloadTimer = 0;
        
        this.aimTimer = 0;
        this.aimLevel = 0;
        this._lastX = x; this._lastY = y;
        
        this.suppressionLevel = 0;
        this.suppressionTimer = 0;
        this.recoveryTimer = 0;
        this._coverTarget = null;
        this.isSuppressing = false;
        this.suppressionTargetPos = null;
        
        this.morale = TACTICS.morale.max;
        this.combatStress = 0;
        this.moraleState = 'normal';
        this.panicTimer = 0;
        this._routingCover = null;
        
        this.radio = null;
        this.radioJamTimer = 0;
        this.pendingOrder = null;
        this.knownEnemies = [];
        this._lastReportTime = 0;
        this._reportedTarget = false;
        this._reportedFire = false;
        this._reportedAmmo = false;
        this._lastFireReport = 0;
        this._lastAmmoReport = 0;
        this._lastDeathReport = 0;
        
        this.grenades = { frag: 2, smoke: 1 };
        this.grenadeCooldown = 0;
        this.grenadeThrowTimer = 0;
        this.meleeCooldown = 0;
        this.smokeCooldown = 0;
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
            const existing = this.knownEnemies.find(e => Math.hypot(e.x - data.x, e.y - data.y) < 20);
            if (existing) existing.time = performance.now();
            else this.knownEnemies.push({ x: data.x, y: data.y, time: performance.now() });
        } else if (type === 'taking_fire') {
            this.morale = Math.max(0, this.morale - 3);
            this.combatStress = Math.min(100, this.combatStress + 5);
        } else if (type === 'ammo_low') {
            this._needResupply = true;
        }
    }
    
    updateMorale(dt, allUnits) {
        if (this.dead) return;
        const M = TACTICS.morale;
        const hpRatio = this.health.totalHp().current / this.health.totalHp().max;
        if (hpRatio < 0.5) this.morale -= M.decayWounded * dt;
        if (this.suppressionLevel > 40) this.morale -= M.decaySuppression * dt;
        
        const enemyNear = allUnits.some(u => !u.dead && u.team !== this.team && dist(u, this) < TACTICS.viewRange);
        if (enemyNear) this.combatStress = Math.min(100, this.combatStress + M.stressGain * dt);
        else this.combatStress = Math.max(0, this.combatStress - M.stressDecay * dt);
        
        if (this.combatStress > M.stressThreshold) {
            const excess = (this.combatStress - M.stressThreshold) / 40;
            this.morale -= (M.decayStress + excess * 2) * dt;
        }
        
        if (this.morale < M.max) {
            let regen = M.regenBase * dt;
            const leaderNearby = allUnits.some(u => !u.dead && u.team === this.team &&
                (u.role === 'commander' || u.role === 'squad_leader') && dist(u, this) < M.leaderRadius);
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
        if (this.dead || this.stance !== this.desiredStance) return null;
        if (!this.health.canShoot()) return null;
        if (this.ammo <= 0) { this.isReloading = true; this.reloadTimer = this.weapon.reloadTime; this.isSuppressing = false; return null; }
        this.ammo--;
        this.cooldown = this.weapon.fireRate;
        this.muzzleFlash = 0.06;
        const tx = this.suppressionTargetPos.x + (Math.random() - 0.5) * 25;
        const ty = this.suppressionTargetPos.y + (Math.random() - 0.5) * 25;
        allUnits.forEach(u => {
            if (u.dead || u.team === this.team) return;
            const d = Math.hypot(u.x - tx, u.y - ty);
            const area = TACTICS.suppressionRadius * TACTICS.suppressionMGMult;
            if (d < area) u.applySuppression((1 - d / area) * this.weapon.suppressionPower);
        });
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
        if (this.dead || target.dead) return 0;
        if (!this.health.canShoot()) return 0;
        const d = dist(this, target);
        const w = this.weapon;
        let chance = w.accuracy;
        
        if (rayBlocked(this.x, this.y, target.x, target.y, GAME.obstacles)) return TACTICS.hitChanceMin;
        
        if (GAME.smokes && GAME.smokes.length > 0) {
            for (const s of GAME.smokes) {
                if (Math.hypot(target.x - s.x, target.y - s.y) < s.radius) { chance *= 0.3; break; }
            }
        }
        
        if (d <= w.effRange) chance *= (1 - Math.pow(d / w.effRange, 2) * 0.25);
        else if (d <= w.maxRange) {
            const over = (d - w.effRange) / (w.maxRange - w.effRange);
            chance *= (0.75 - over * 0.65);
        } else return 0;
        
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
        if (this.dead || this.isReloading) return null;
        if (this.moraleState === 'surrendered' || this.moraleState === 'routing') return null;
        if (this.stance !== this.desiredStance) return null;
        if (!this.health.canShoot()) return null;
        
        const isGL = this.weapon.hasGL && Math.random() < 0.3;
        if (isGL && this.glAmmo <= 0) return null;
        if (!isGL && this.ammo <= 0) {
            this.isReloading = true;
            this.reloadTimer = this.weapon.reloadTime;
            this.aimTimer = 0;
            return null;
        }
        
        if (isGL) this.glAmmo--; else this.ammo--;
        this.cooldown = this.weapon.fireRate;
        this.muzzleFlash = 0.06;
        
        const t = this.target;
        if (!t || t.dead) return null;
        
        if (!this._reportedAmmo && this.ammo < this.weapon.magSize) {
            this.report('ammo_low', { ammo: this.ammo });
            this._reportedAmmo = true;
        }
        
        const isExplosive = this.weapon.isAntiTank || isGL;
        
        if (isExplosive) {
            const blastRadius = isGL ? this.weapon.glBlast : this.weapon.blastRadius;
            let hitX = t.x, hitY = t.y;
            if (this.weapon.isAntiTank) { hitX += (Math.random() - 0.5) * 15; hitY += (Math.random() - 0.5) * 15; }
            const d = dist(this, t);
            if (d > this.weapon.effRange) {
                const scatter = (d - this.weapon.effRange) / 2;
                hitX += (Math.random() - 0.5) * scatter;
                hitY += (Math.random() - 0.5) * scatter;
            }
            
            allUnits.forEach(u => {
                if (u.dead || u.team === this.team) return;
                const dd = Math.hypot(u.x - hitX, u.y - hitY);
                if (dd < blastRadius) {
                    const falloff = 1 - dd / blastRadius;
                    const dmg = (isGL ? 80 : (this.weapon.isAntiTank ? 100 : this.weapon.damage)) * falloff;
                    const result = u.health.takeDamage(dmg);
                    u._showDamage(dmg, result.part);
                    if (result.died || u.health.dead) {
                        u.hp = 0; u.dead = true; u.deathTime = performance.now();
                        this._notifyDeath(u, allUnits);
                    }
                }
                if (dd < blastRadius * 2) {
                    u.applySuppression((1 - dd / (blastRadius * 2)) * 1.5 * this.weapon.suppressionPower);
                }
            });
            
            return { type: 'explosion', x: hitX, y: hitY, radius: blastRadius };
        }
        
        const hit = Math.random() < this.hitChance(t);
        let tx = t.x, ty = t.y;
        
        if (hit) {
            const variance = TACTICS.damageVariance;
            const dmg = this.weapon.damage * (1 - variance + Math.random() * variance * 2);
            const result = t.health.takeDamage(dmg);
            t._showDamage(dmg, result.part);
            if (!t._reportedFire) { t.report('taking_fire', { from: { x: this.x, y: this.y } }); t._reportedFire = true; }
            if (result.died || t.health.dead) {
                t.hp = 0; t.dead = true; t.deathTime = performance.now();
                this._notifyDeath(t, allUnits);
            }
        } else {
            tx += (Math.random() - 0.5) * 60;
            ty += (Math.random() - 0.5) * 60;
        }
        
        const isMG = this.weaponId === 'pkm' || this.weaponId === 'm249';
        const suppRadius = isMG ? TACTICS.suppressionRadius * TACTICS.suppressionMGMult : TACTICS.suppressionRadius;
        allUnits.forEach(u => {
            if (u.dead || u.team === this.team || u === t) return;
            const dLine = this._distToLine(u.x, u.y, this.x, this.y, tx, ty);
            if (dLine < suppRadius) u.applySuppression((1 - dLine / suppRadius) * this.weapon.suppressionPower);
        });
        
        return { type: 'bullet', x: this.x, y: this.y, tx, ty, team: this.team, isMG };
    }
    
    canThrowGrenade(target) {
        if (this.dead || this.health.dead) return false;
        if (this.grenadeCooldown > 0) return false;
        if (this.grenades.frag <= 0 && this.grenades.smoke <= 0) return false;
        if (!target || target.dead) return false;
        const d = dist(this, target);
        if (d < TACTICS.grenade.minRange || d > TACTICS.grenade.maxRange) return false;
        if (rayBlocked(this.x, this.y, target.x, target.y, GAME.obstacles)) return false;
        return true;
    }
    
    throwGrenade(target, type = 'frag') {
        if (!this.canThrowGrenade(target)) return null;
        if (type === 'frag' && this.grenades.frag <= 0) type = 'smoke';
        if (type === 'smoke' && this.grenades.smoke <= 0) type = 'frag';
        if (this.grenades[type] <= 0) return null;
        
        this.grenades[type]--;
        this.grenadeCooldown = TACTICS.grenade.cooldown;
        this.grenadeThrowTimer = TACTICS.grenade.throwTime;
        this.facing = Math.atan2(target.y - this.y, target.x - this.x);
        
        const d = dist(this, target);
        const scatter = d > 20 ? 3 : 1.5;
        const hitX = target.x + (Math.random() - 0.5) * scatter;
        const hitY = target.y + (Math.random() - 0.5) * scatter;
        
        return {
            type: 'grenade',
            grenadeType: type,
            x: this.x, y: this.y,
            tx: hitX, ty: hitY,
            fuse: TACTICS.grenade.fuseTime || 2.0,
            thrower: this
        };
    }
    
    canMelee(target) {
        if (this.dead || this.health.dead) return false;
        if (this.meleeCooldown > 0) return false;
        if (!target || target.dead) return false;
        return dist(this, target) <= TACTICS.melee.range;
    }
    
    melee(target) {
        if (!this.canMelee(target)) return null;
        this.meleeCooldown = TACTICS.melee.cooldown;
        this.facing = Math.atan2(target.y - this.y, target.x - this.x);
        
        const hit = Math.random() < TACTICS.melee.accuracy;
        if (hit) {
            const dmg = TACTICS.melee.damage * (0.8 + Math.random() * 0.4);
            const result = target.health.takeDamage(dmg, 'torso');
            target._showDamage(dmg, result.part);
            if (result.died || target.health.dead) {
                target.hp = 0;
                target.dead = true;
                target.deathTime = performance.now();
                this._notifyDeath(target, GAME.allUnits);
            }
            return { type: 'melee', x: this.x, y: this.y, tx: target.x, ty: target.y, hit: true };
        }
        return { type: 'melee', x: this.x, y: this.y, tx: target.x, ty: target.y, hit: false };
    }
    
    _notifyDeath(deadUnit, allUnits) {
        this.report('man_down', { role: deadUnit.roleName });
        allUnits.forEach(ally => {
            if (ally.dead || ally.team !== deadUnit.team || ally === deadUnit) return;
            if (dist(ally, deadUnit) < TACTICS.morale.allyDeathRadius) {
                ally.morale = Math.max(0, ally.morale - TACTICS.morale.decayAllyDeath);
                ally.combatStress = Math.min(100, ally.combatStress + 10);
            }
        });
        if (typeof Audio !== 'undefined') Audio.death();
    }
    
    _showDamage(dmg, part) {
        if (typeof GAME !== 'undefined' && GAME.damageTexts) {
            const partName = part ? BODY_PARTS[part].name : '';
            GAME.damageTexts.push({ x: this.x, y: this.y - 10, text: `-${Math.round(dmg)}${partName ? ' ' + partName : ''}`, life: 1.0, color: '#ff4444' });
        }
    }
    
    _distToLine(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        if (len < 0.01) return Math.hypot(px - x1, py - y1);
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (len * len)));
        return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }
    
    autoSelectStance() {
        if (this.dead || this.suppressionLevel > 40 || this.stanceLocked) return;
        const isMoving = this.state === 'moving';
        const inCombat = this.target && dist(this, this.target) <= this.weapon.maxRange;
        
        if (isMoving) this.setStance('stand');
        else if (inCombat) {
            if (this.weaponId === 'rpg7') this.setStance('crouch');
            else if (this.weaponId === 'm110' || this.role === 'mg') this.setStance('prone');
            else this.setStance('crouch');
        } else if (this.holding) this.setStance('crouch');
        else this.setStance('stand');
        
        if (this.moraleState === 'cautious' && this.state !== 'moving') this.setStance('crouch');
        if (!this.health.canWalk()) this.setStance('prone');
    }
    
    setStance(stance) {
        if (this.stance === stance || this.desiredStance === stance) return;
        this.desiredStance = stance;
        this.stanceTimer = TACTICS.stanceSwitchTime;
        this.aimTimer = 0;
    }
    
    moveTo(tx, ty, dt, obstacles) {
        const dx = tx - this.x, dy = ty - this.y;
        const d = Math.hypot(dx, dy);
        if (d < 2) return true;
        
        const healthSpeed = this.health.speedPenalty();
        const stanceSpeed = STANCES[this.stance].speed;
        const spd = TACTICS.speed * stanceSpeed * healthSpeed * Weather.speedMult();
        const step = Math.min(d, spd * dt);
        
        if (!this.health.canWalk()) {
            this._tryMove(dx, dy, d, step * 0.35, obstacles);
            return false;
        }
        
        this._tryMove(dx, dy, d, step, obstacles);
        return false;
    }
    
    _tryMove(dx, dy, d, step, obstacles) {
        const baseAngle = Math.atan2(dy, dx);
        const angles = [0, Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4, Math.PI];
        for (let i = 0; i < angles.length; i++) {
            const angle = baseAngle + angles[i];
            const nx = this.x + Math.cos(angle) * step;
            const ny = this.y + Math.sin(angle) * step;
            const cx = Math.max(4, Math.min(WORLD.width - 4, nx));
            const cy = Math.max(4, Math.min(WORLD.height - 4, ny));
            if (!pointInAnyObstacle(cx, cy, obstacles, ['tree', 'bush'])) {
                this.x = cx; this.y = cy;
                if (angles[i] === 0) this.facing = baseAngle;
                return;
            }
        }
    }
    
    findEnemy(allUnits, obstacles, mapType, spatialHash) {
        let best = null;
        let bestScore = -Infinity;
        const viewRange = (mapType === 'forest' ? TACTICS.viewRange * 0.7 : TACTICS.viewRange) * Weather.viewRangeMult();
        const candidates = spatialHash ? spatialHash.queryRadius(this.x, this.y, viewRange) : allUnits;
        const P = TACTICS.targetPriority;
        
        for (let i = 0; i < candidates.length; i++) {
            const u = candidates[i];
            if (u.dead || u.team === this.team) continue;
            const d = dist(this, u);
            if (d > viewRange) continue;
            if (rayBlocked(this.x, this.y, u.x, u.y, obstacles)) continue;
            
            const roleWeight = P.roleWeight[u.role] || 1;
            const distScore = P.distanceWeight * (100 - d) / 100;
            
            const angleTo = Math.atan2(u.y - this.y, u.x - this.x);
            let angleDiff = Math.abs(angleTo - this.facing);
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
            const frontScore = P.frontWeight * (1 - angleDiff / Math.PI);
            
            const coverScore = u.currentObstacle ? -P.coverWeight : 0;
            const woundedScore = u.health.totalHp().current / u.health.totalHp().max < 0.5 ? -P.woundedWeight : 0;
            
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
