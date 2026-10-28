// ==================== ENTITIES.JS ====================
// Классы Soldier, Squad, Radio. Без привязки к canvas/DOM.

// ---------- Утилиты ----------
function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }

function pointInRect(x, y, rect, padding = 0) {
    return x > rect.x - rect.w / 2 - padding &&
           x < rect.x + rect.w / 2 + padding &&
           y > rect.y - rect.h / 2 - padding &&
           y < rect.y + rect.h / 2 + padding;
}

function pointInAnyObstacle(x, y, obstacles, skipTypes = []) {
    for (const obs of obstacles) {
        if (skipTypes.includes(obs.type)) continue;
        if (pointInRect(x, y, obs)) return obs;
    }
    return null;
}

// Пересечение отрезка с прямоугольником (алгоритм Лианга-Барски)
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
    for (const obs of obstacles) {
        if (obs.type === 'tree') continue;
        if (segmentIntersectsRect(x1, y1, x2, y2, obs)) return obs;
    }
    return null;
}

// Ближайшая точка у края препятствия (для укрытия)
function nearestCoverPoint(x, y, obstacles, maxDist) {
    let best = null, bestDist = maxDist;
    for (const obs of obstacles) {
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

// ---------- Радиосеть ----------
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
        for (const u of this.members) {
            if (u === sender || u.dead) continue;
            if (dist(u, sender) > this.range) continue;
            u.onReport(sender, type, data);
        }
    }
    reset() { this.jammed = false; this.members = []; }
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
        
        // Состояние
        this.hp = 100;
        this.maxHp = 100;
        this.dead = false;
        this.deathTime = 0;
        
        // Движение
        this.facing = 0;
        this.manualControl = false;
        this.moveTarget = null;       // только ручные приказы
        this.formationSlot = null;    // слот в формации (движется с лидером)
        this._hasActiveOrder = false;
        this.state = 'idle';
        
        // Стойка
        this.stance = 'stand';
        this.desiredStance = 'stand';
        this.stanceTimer = 0;
        this.stanceLocked = false;
        
        // Стрельба
        this.target = null;
        this.cooldown = 0;
        this.muzzleFlash = 0;
        this.ammo = this.weapon.maxAmmo;
        this.glAmmo = this.weapon.glAmmo || 0;
        this.isReloading = false;
        this.reloadTimer = 0;
        
        // Прицеливание
        this.aimTimer = 0;
        this.aimLevel = 0;
        this._lastX = x; this._lastY = y;
        
        // Подавление
        this.suppressionLevel = 0;
        this.suppressionTimer = 0;
        this.recoveryTimer = 0;
        this._coverTarget = null;
        this.isSuppressing = false;
        this.suppressionTargetPos = null;
        
        // Мораль
        this.morale = TACTICS.morale.max;
        this.combatStress = 0;
        this.moraleState = 'normal';
        this.panicTimer = 0;
        this._routingCover = null;
        
        // Связь
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
    }
    
    // ========== ВВОД ==========
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
    
    // ========== МОРАЛЬ ==========
    updateMorale(dt, allUnits) {
        if (this.dead) return;
        const M = TACTICS.morale;
        
        if (this.hp < 50) this.morale -= M.decayWounded * dt;
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
    
    // ========== СТРЕЛЬБА ==========
    fireSuppression(allUnits) {
        if (this.dead || this.stance !== this.desiredStance) return;
        if (this.ammo <= 0) { this.isReloading = true; this.reloadTimer = this.weapon.reloadTime; this.isSuppressing = false; return; }
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
        const d = dist(this, target);
        const w = this.weapon;
        let chance = w.accuracy;
        
        if (rayBlocked(this.x, this.y, target.x, target.y, GAME.obstacles)) return TACTICS.hitChanceMin;
        
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
                    u.hp -= dmg;
                    u._showDamage(dmg);
                    if (u.hp <= 0) { u.hp = 0; u.dead = true; u.deathTime = performance.now(); this._notifyDeath(u, allUnits); }
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
            t.hp -= dmg;
            t._showDamage(dmg);
            if (!t._reportedFire) { t.report('taking_fire', { from: { x: this.x, y: this.y } }); t._reportedFire = true; }
            if (t.hp <= 0) { t.hp = 0; t.dead = true; t.deathTime = performance.now(); this._notifyDeath(t, allUnits); }
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
    
    _notifyDeath(deadUnit, allUnits) {
        this.report('man_down', { role: deadUnit.roleName });
        allUnits.forEach(ally => {
            if (ally.dead || ally.team !== deadUnit.team || ally === deadUnit) return;
            if (dist(ally, deadUnit) < TACTICS.morale.allyDeathRadius) {
                ally.morale = Math.max(0, ally.morale - TACTICS.morale.decayAllyDeath);
                ally.combatStress = Math.min(100, ally.combatStress + 10);
            }
        });
    }
    
    _showDamage(dmg) {
        if (typeof GAME !== 'undefined' && GAME.damageTexts) {
            GAME.damageTexts.push({ x: this.x, y: this.y - 10, text: `-${Math.round(dmg)}`, life: 1.0, color: '#ff4444' });
        }
    }
    
    _distToLine(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        if (len < 0.01) return Math.hypot(px - x1, py - y1);
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (len * len)));
        return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }
    
    // ========== СТОЙКА ==========
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
    }
    
    setStance(stance) {
        if (this.stance === stance || this.desiredStance === stance) return;
        this.desiredStance = stance;
        this.stanceTimer = TACTICS.stanceSwitchTime;
        this.aimTimer = 0;
    }
    
    // ========== ДВИЖЕНИЕ ==========
    // Прямое движение к точке с обходом препятствий (без A*)
    // Возвращает true, если юнит достиг цели
    moveTo(tx, ty, dt, obstacles) {
        const dx = tx - this.x, dy = ty - this.y;
        const d = Math.hypot(dx, dy);
        if (d < 2) return true;
        
        const stanceSpeed = STANCES[this.stance].speed;
        const spd = TACTICS.speed * stanceSpeed;
        const step = Math.min(d, spd * dt);
        
        // Пробуем 8 направлений (прямое, перпендикуляры, диагонали)
        const baseAngle = Math.atan2(dy, dx);
        const angles = [0, Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4, Math.PI];
        
        for (const offset of angles) {
            const angle = baseAngle + offset;
            const nx = this.x + Math.cos(angle) * step;
            const ny = this.y + Math.sin(angle) * step;
            
            const clampedX = Math.max(4, Math.min(WORLD.width - 4, nx));
            const clampedY = Math.max(4, Math.min(WORLD.height - 4, ny));
            
            if (!pointInAnyObstacle(clampedX, clampedY, obstacles, ['tree', 'bush'])) {
                this.x = clampedX;
                this.y = clampedY;
                if (offset === 0) this.facing = baseAngle;
                return false;
            }
        }
        
        return false; // застряли
    }
    
    // ========== ПОИСК ЦЕЛИ ==========
    findEnemy(allUnits, obstacles, mapType) {
        let best = null;
        let bestScore = -Infinity;
        for (const u of allUnits) {
            if (u.dead || u.team === this.team) continue;
            const d = dist(this, u);
            let viewRange = TACTICS.viewRange;
            if (mapType === 'forest') viewRange *= 0.7;
            if (d > viewRange) continue;
            if (rayBlocked(this.x, this.y, u.x, u.y, obstacles)) continue;
            
            const p = TARGET_PRIORITY[u.role] || 1;
            const score = p * 100 - d;
            if (score > bestScore) { bestScore = score; best = u; }
        }
        return best;
    }
}
