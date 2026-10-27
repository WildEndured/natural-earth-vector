// ==================== КЛАСС SOLDIER ====================
// Зависимости: CONFIG, WEAPONS, obstacles, currentMapType, 
//              bullets, explosions, damageTexts, allUnits, selectedUnits, camera

class Soldier {
    constructor(x, y, team, role, roleName, weaponId, groupId = null) {
        this.x = x; this.y = y; this.team = team; this.role = role; this.roleName = roleName;
        this.groupId = groupId; this.radius = CONFIG.soldierRadius;
        this.hp = 100; this.maxHp = 100; this.dead = false;
        this.target = null; this.moveTarget = null; this.followTarget = null; this.formationPos = null;
        this.state = 'idle'; this.cooldown = 0; this.facing = 0; this.muzzleFlash = 0; this.holding = false;
        this.stance = 'stand'; this.desiredStance = 'stand'; this.stanceTimer = 0; this.stanceLocked = false;
        this.weapon = WEAPONS[weaponId] || WEAPONS.ak74m; this.weaponId = weaponId;
        this.range = this.weapon.effRange; this.damage = this.weapon.damage; this.fireRate = this.weapon.fireRate;
        this.accuracy = this.weapon.baseAccuracy;
        this.ammo = this.weapon.maxAmmo; this.glAmmo = this.weapon.glAmmo || 0;
        this.reloadTimer = 0; this.isReloading = false;
        this.suppressionTimer = 0; this.suppressionFlash = 0; this.suppressionLevel = 0; this.recoveryTimer = 0;
        this.currentObstacle = null; this.manualControl = false;
        this.panicTimer = 0; this.isSuppressing = false; this.suppressionTargetPos = null; this.deathTime = 0;
        this.aimTimer = 0; this.aimLevel = 0; this.lastX = x; this.lastY = y;
        this.morale = 100; this.combatStress = 0; this.moraleState = 'normal';
        this._coverTarget = null;

        // Связь
        this.radio = null; this.reports = []; this.knownEnemies = [];
        this.lastReportTime = 0; this.radioJamTimer = 0; this.pendingOrder = null;
        this._reportedTarget = false; this._reportedFire = false; this._reportedAmmo = false;
        this._reportedBound = false; this._groupStatus = {};

        // Тактика
        this.phaseTimer = 0; this._reachedBound = false; this._boundIndex = 0;
        this._bounds = null; this._reachedFirePos = false; this._reachedManeuver = false;
        this._firePos = null; this._maneuverPos = null; this._hasSniperPos = false;
        this._routingCover = null;
    }

    update(dt, allUnits) {
        if (this.dead) return;
        this.currentObstacle = pointInObstacle(this.x, this.y);
        if (this.panicTimer > 0) this.panicTimer -= dt;
        if (this.radioJamTimer > 0) this.radioJamTimer -= dt;
        if (this.phaseTimer > 0) this.phaseTimer -= dt;

        if (this.suppressionLevel > 0) {
            this.suppressionLevel = Math.max(0, this.suppressionLevel - dt * CONFIG.suppressionDecay);
            this.suppressionTimer = Math.max(0, this.suppressionTimer - dt);
            this.suppressionFlash = Math.max(0, this.suppressionFlash - dt);
        }
        if (this.suppressionLevel > 10 && this.suppressionLevel <= 40 && this.recoveryTimer <= 0) this.recoveryTimer = CONFIG.suppressionRecovery;
        if (this.recoveryTimer > 0) this.recoveryTimer -= dt;

        this.updateMorale(dt, allUnits);
        
        if (this.moraleState === 'surrendered') { this.state = 'surrendered'; this.moveTarget = null; this.holding = false; this.target = null; this.setStance('stand'); return; }
        
        if (this.moraleState === 'routing') {
            this.suppressionLevel = 0; this.suppressionTimer = 0;
            const enemy = this.findEnemy(allUnits);
            if (enemy) {
                const fleeAngle = Math.atan2(this.y - enemy.y, this.x - enemy.x);
                this.state = 'routing'; this.setStance('stand'); this.facing = fleeAngle;
                if (!this._routingCover || Math.hypot(this._routingCover.x - this.x, this._routingCover.y - this.y) < 5) {
                    this._routingCover = this.findNearestCover(this.x + Math.cos(fleeAngle) * 80, this.y + Math.sin(fleeAngle) * 80, 80);
                }
                let tx, ty;
                if (this._routingCover) { tx = this._routingCover.x; ty = this._routingCover.y; }
                else {
                    const margin = 50;
                    const dist = { left: this.x, right: WORLD.width - this.x, top: this.y, bottom: WORLD.height - this.y };
                    if (dist.right > dist.left && dist.right > dist.top && dist.right > dist.bottom) { tx = WORLD.width - margin; ty = this.y; }
                    else if (dist.left > dist.top && dist.left > dist.bottom) { tx = margin; ty = this.y; }
                    else if (dist.top > dist.bottom) { tx = this.x; ty = margin; }
                    else { tx = this.x; ty = WORLD.height - margin; }
                }
                this.moveToward(tx, ty, dt);
            }
            return;
        }

        if (this.moraleState === 'panicked') {
            this.setStance('prone'); this.state = 'panicked';
            this.target = this.findEnemy(allUnits);
            if (this.target && this.cooldown <= 0 && !this.isReloading && Math.random() < 0.3) {
                this.facing = Math.atan2(this.target.y - this.y, this.target.x - this.x); this.fire();
            }
            return;
        }

        if (this.suppressionLevel > 40) {
            this.setStance('prone'); this.state = 'suppressed';
            this.target = this.findEnemy(allUnits);
            if (!this._coverTarget || Math.hypot(this._coverTarget.x - this.x, this._coverTarget.y - this.y) < 3) this._coverTarget = this.findNearestCover(this.x, this.y, 20);
            if (this._coverTarget) this.moveToward(this._coverTarget.x, this._coverTarget.y, dt * 0.5);
            if (this.target && this.cooldown <= 0 && !this.isReloading && Math.random() < 0.5) {
                this.facing = Math.atan2(this.target.y - this.y, this.target.x - this.x); this.fire();
            }
            return;
        }

        if (this.isReloading) {
            const speedMult = this.suppressionLevel > 40 ? 0.5 : 1.0;
            this.reloadTimer -= dt * speedMult;
            if (this.reloadTimer <= 0) this.isReloading = false;
            return;
        }

        this.cooldown = Math.max(0, this.cooldown - dt);
        if (this.muzzleFlash > 0) this.muzzleFlash -= dt;
        if (this.stance !== this.desiredStance) { this.stanceTimer -= dt; if (this.stanceTimer <= 0) this.stance = this.desiredStance; }

        if (this.isSuppressing && this.suppressionTargetPos) {
            this.setStance('prone');
            this.facing = Math.atan2(this.suppressionTargetPos.y - this.y, this.suppressionTargetPos.x - this.x);
            if (this.cooldown <= 0 && !this.isReloading) this.fireSuppression();
            return;
        }

        if (this.pendingOrder && (this.role === 'commander' || this.role === 'squad_leader')) {
            this.pendingOrder.time -= dt;
            if (this.pendingOrder.time <= 0) {
                const order = this.pendingOrder; this.pendingOrder = null;
                if (order.type === 'move') {
                    this.moveTarget = { x: order.x, y: order.y };
                    this.facing = Math.atan2(order.y - this.y, order.x - this.x);
                    if (typeof Formation !== 'undefined') Formation.apply(this);
                }
                this.report('order_received', { type: order.type });
            }
        }

        this.target = this.findEnemy(allUnits);

        if (this.target && !this._reportedTarget) {
            this.report('enemy_spotted', { x: this.target.x, y: this.target.y });
            this._reportedTarget = true;
        }

        const physicallyMoving = Math.hypot(this.x - this.lastX, this.y - this.lastY) > 0.05;
        this.lastX = this.x; this.lastY = this.y;
        const canAim = this.target && !physicallyMoving && this.state !== 'moving'
                       && this.suppressionLevel <= 40 && !this.isReloading
                       && this.stance === this.desiredStance;
        if (canAim) this.aimTimer = Math.min(CONFIG.aimTime, this.aimTimer + dt);
        else this.aimTimer = Math.max(0, this.aimTimer - dt * 3);
        const aimT = this.aimTimer / CONFIG.aimTime;
        this.aimLevel = aimT * aimT * (3 - 2 * aimT);

        if (CONFIG.autoStance && !this.stanceLocked) this.autoSelectStance();

        // === ПОВЕДЕНИЕ ===
        if (this.target && this.distanceTo(this.target) <= this.weapon.maxRange) {
            this.state = 'attacking';
            this.facing = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            if (this.distanceTo(this.target) <= this.weapon.effRange) {
                if (this.cooldown <= 0) this.fire();
            } else if (!this.holding && !this.moveTarget) this.moveToward(this.target.x, this.target.y, dt);
        } else if (this.holding) {
            this.state = 'holding';
            this.moveTarget = null;
        } else if (this.moveTarget) {
            this.state = 'moving';
            this.moveToward(this.moveTarget.x, this.moveTarget.y, dt);
            if (this.distanceTo(this.moveTarget) < 4) this.moveTarget = null;
        } else if (this.formationPos) {
            const d = Math.hypot(this.formationPos.x - this.x, this.formationPos.y - this.y);
            if (d > 3) { 
                this.state = 'moving'; 
                this.moveToward(this.formationPos.x, this.formationPos.y, dt); 
            } else { 
                this.state = 'idle'; 
            }
        } else if (this.followTarget && !this.followTarget.dead) {
            const d = this.distanceTo(this.followTarget);
            if (d > 20) { this.moveToward(this.followTarget.x, this.followTarget.y, dt); this.state = 'moving'; }
            else this.state = 'idle';
        } else { 
            this.state = 'idle'; 
        }
    }

    report(type, data) {
        if (!this.radio || this.dead) return;
        if (this.radioJamTimer > 0) return;
        const now = performance.now();
        if (now - this.lastReportTime < CONFIG.radio.reportCooldown * 1000) return;
        this.lastReportTime = now;
        this.radio.broadcast(this, type, data);
    }

    receiveReport(sender, type, data) {
        if (this.radioJamTimer > 0) return;
        if (type === 'enemy_spotted') {
            const exists = this.knownEnemies.find(e => Math.hypot(e.x - data.x, e.y - data.y) < 20);
            if (!exists) this.knownEnemies.push({ x: data.x, y: data.y, time: performance.now() });
            else exists.time = performance.now();
        } else if (type === 'taking_fire') {
            this.morale = Math.max(0, this.morale - 3);
            this.combatStress = Math.min(100, this.combatStress + 5);
        } else if (type === 'ammo_low') { this._needResupply = true; }
        else if (type === 'position_reached') { this._groupStatus[data.group] = 'reached'; }
    }

    updateMorale(dt, allUnits) {
        if (this.dead) return;
        if (this.hp < 50) this.morale -= CONFIG.morale.decayWounded * dt;
        if (this.suppressionLevel > 40) this.morale -= CONFIG.morale.decaySuppression * dt;
        const enemyNear = allUnits.some(u => !u.dead && u.team !== this.team && this.distanceTo(u) < CONFIG.viewRange);
        if (enemyNear) this.combatStress = Math.min(100, this.combatStress + CONFIG.morale.combatStressGain * dt);
        else this.combatStress = Math.max(0, this.combatStress - CONFIG.morale.combatStressDecay * dt);
        
        if (this.combatStress > CONFIG.morale.combatStressThreshold) {
            const excess = (this.combatStress - CONFIG.morale.combatStressThreshold) / 40;
            this.morale -= (CONFIG.morale.decayCombatStress + excess * 2) * dt;
        }
        
        if (this.morale < 100) {
            let regen = CONFIG.morale.regenBase * dt;
            const leaderNearby = allUnits.some(u => !u.dead && u.team === this.team && (u.role === 'commander' || u.role === 'squad_leader') && this.distanceTo(u) < CONFIG.morale.leaderRadius);
            if (leaderNearby) regen *= CONFIG.morale.regenLeaderNearby;
            if (this.suppressionLevel < 10) regen *= CONFIG.morale.regenNoSuppression;
            this.morale = Math.min(100, this.morale + regen);
        }
        this.morale = Math.max(0, Math.min(100, this.morale));
        const t = CONFIG.morale.thresholds;
        if (this.morale < t.surrendered) this.moraleState = 'surrendered';
        else if (this.morale < t.routing) this.moraleState = 'routing';
        else if (this.morale < t.panicked) this.moraleState = 'panicked';
        else if (this.morale < t.cautious) this.moraleState = 'cautious';
        else this.moraleState = 'normal';
    }

    fireSuppression() {
        if (this.dead) return;
        if (this.stance !== this.desiredStance) return;
        if (this.ammo <= 0) { this.isReloading = true; this.reloadTimer = this.weapon.reloadTime || 3.0; this.isSuppressing = false; return; }
        this.ammo--; this.cooldown = this.fireRate; this.muzzleFlash = 0.06;
        if (typeof playSound === 'function') playSound('mg');
        const tx = this.suppressionTargetPos.x + (Math.random()-0.5)*25;
        const ty = this.suppressionTargetPos.y + (Math.random()-0.5)*25;
        bullets.push({ x: this.x, y: this.y, tx, ty, color: this.team === 'RU' ? '#ffdd55' : '#66ddff', life: 0.15, team: this.team, isSuppression: true });
        const power = this.weapon.suppressionPower || 1;
        const area = CONFIG.suppressionRadius * CONFIG.suppressionMGMultiplier;
        allUnits.forEach(u => {
            if (u.dead || u.team === this.team) return;
            const d = Math.hypot(u.x - tx, u.y - ty);
            if (d < area) { const intensity = 1 - (d / area); u.applySuppression(power * intensity); }
        });
    }

    applySuppression(intensity = 1) {
        if (this.dead) return;
        this.suppressionLevel = Math.min(100, this.suppressionLevel + 25 * intensity);
        this.suppressionTimer = Math.max(this.suppressionTimer, 1.5);
        this.suppressionFlash = 0.6;
        this.aimTimer = 0;
        if (this.suppressionLevel > 40) { this.setStance('prone'); this.moveTarget = null; }
    }

    calculateHitChance(target) {
        const dist = this.distanceTo(target); const w = this.weapon;
        let chance = this.accuracy;
        if (rayHitsObstacle(this.x, this.y, target.x, target.y)) return Math.max(0.05, chance * 0.1);
        if (this.panicTimer > 0) chance *= 0.5;
        if (dist <= w.effRange) chance *= (1.0 - Math.pow(dist / w.effRange, 2) * 0.25);
        else if (dist <= w.maxRange) {
            const overRatio = (dist - w.effRange) / (w.maxRange - w.effRange);
            chance *= (0.75 - overRatio * 0.65);
        } else return 0;
        chance *= CONFIG.stanceModifiers[this.stance].hitChanceMod;
        chance *= CONFIG.stanceModifiers[target.stance].targetSizeMult;
        if (this.state === 'moving') chance *= CONFIG.movingAccuracyPenalty;
        if (this.stance !== this.desiredStance) chance *= CONFIG.stanceSwitchPenalty;
        if (w.bipod && this.stance === 'prone' && this.state !== 'moving') chance *= CONFIG.bipodBonus;
        if (target.currentObstacle) chance *= 0.5;
        if (this.suppressionLevel > 40) chance *= CONFIG.suppressionAccuracyPenalty;
        else if (this.recoveryTimer > 0) chance *= 0.7;
        if (this.moraleState === 'surrendered') return 0;
        if (this.moraleState === 'routing') chance *= 0.1;
        else if (this.moraleState === 'panicked') chance *= 0.4;
        else if (this.moraleState === 'cautious') chance *= 0.7;
        let aimBonus = CONFIG.aimBonusStandard;
        if (this.weaponId === 'm110') aimBonus = CONFIG.aimBonusSniper;
        else if (this.role === 'mg' && this.stance === 'prone') aimBonus = CONFIG.aimBonusMG;
        chance *= (1 + (this.aimLevel || 0) * aimBonus);
        return Math.max(0.05, Math.min(0.95, chance));
    }

    fire() {
        if (this.isReloading) return;
        if (this.moraleState === 'surrendered' || this.moraleState === 'routing') return;
        if (this.stance !== this.desiredStance) return;
        const isGL = this.weapon.hasGL && Math.random() < 0.3;
        if (isGL && this.glAmmo <= 0) return;
        if (!isGL && this.ammo <= 0) { this.isReloading = true; this.reloadTimer = this.weapon.reloadTime || 3.0; this.aimTimer = 0; return; }
        if (isGL) this.glAmmo--; else this.ammo--;
        this.cooldown = this.fireRate; this.muzzleFlash = 0.06;
        if (typeof playSound === 'function') {
            if (this.weaponId === 'pkm' || this.weaponId === 'm249') playSound('mg');
            else if (!isGL) playSound('shot');
        }

        const t = this.target; if (!t || t.dead) return;
        const dist = this.distanceTo(t); const isExplosive = this.weapon.isAntiTank || isGL;

        if (!this._reportedAmmo && this.ammo < this.weapon.magSize) {
            this.report('ammo_low', { ammo: this.ammo });
            this._reportedAmmo = true;
        }

        if (isExplosive) {
            if (typeof playSound === 'function') playSound('explosion');
            const blastRadius = isGL ? (this.weapon.glBlast || 5) : (this.weapon.isAntiTank ? 4 : 8);
            let hitX = t.x, hitY = t.y;
            if (this.weapon.isAntiTank) { hitX += (Math.random()-0.5)*15; hitY += (Math.random()-0.5)*15; }
            if (dist > this.weapon.effRange) { const scatter = (dist - this.weapon.effRange) / 2; hitX += (Math.random()-0.5)*scatter; hitY += (Math.random()-0.5)*scatter; }
            allUnits.forEach(u => {
                if (u.dead || u.team === this.team) return;
                const d = Math.hypot(u.x - hitX, u.y - hitY);
                if (d < blastRadius) {
                    const falloff = 1 - (d / blastRadius);
                    const dmg = (isGL ? 80 : (this.weapon.isAntiTank ? 100 : this.damage)) * falloff;
                    u.hp -= dmg; u.showDamageText(dmg);
                    if (u.hp <= 0) { u.hp = 0; u.dead = true; u.deathTime = performance.now(); this.notifyAllyDeath(u, allUnits); }
                }
            });
            allUnits.forEach(u => {
                if (u.dead || u.team === this.team) return;
                const d = Math.hypot(u.x - hitX, u.y - hitY);
                if (d < blastRadius * 2) { const intensity = 1 - (d / (blastRadius * 2)); u.applySuppression(1.5 * intensity * (this.weapon.suppressionPower || 1)); }
            });
            explosions.push({ x: hitX, y: hitY, radius: blastRadius, life: 0.5 });
            bullets.push({ x: this.x, y: this.y, tx: hitX, ty: hitY, color: '#ff6b1a', life: 0.3, team: this.team, isRPG: true });
        } else {
            const hitChance = this.calculateHitChance(t); const hit = Math.random() < hitChance;
            if (hit) {
                if (typeof playSound === 'function') playSound('hit');
                const dmg = this.damage * (0.9 + Math.random() * 0.2);
                t.hp -= dmg; t.showDamageText(dmg);
                if (!t._reportedFire) { t.report('taking_fire', { from: { x: this.x, y: this.y } }); t._reportedFire = true; }
                decorations.push({ type: 'blood', x: t.x + (Math.random()-0.5)*10, y: t.y + (Math.random()-0.5)*10, r: 3 + Math.random()*4, life: 999 });
                if (t.hp <= 0) { t.hp = 0; t.dead = true; t.deathTime = performance.now(); this.notifyAllyDeath(t, allUnits); }
            }
            let tx = t.x, ty = t.y;
            if (!hit) { tx += (Math.random()-0.5)*60; ty += (Math.random()-0.5)*60; }
            bullets.push({ x: this.x, y: this.y, tx, ty, color: this.team === 'RU' ? '#ffdd55' : '#66ddff', life: 0.15, team: this.team });
            if (Math.random() < 0.3) decorations.push({ type: 'bulletmark', x: tx, y: ty, r: 1.5, life: 999 });

            const isMG = this.weaponId === 'pkm' || this.weaponId === 'm249';
            const suppRadius = isMG ? CONFIG.suppressionRadius * CONFIG.suppressionMGMultiplier : CONFIG.suppressionRadius;
            const suppPower = this.weapon.suppressionPower || 1;
            allUnits.forEach(u => {
                if (u.dead || u.team === this.team) return;
                const distToLine = this.distanceToLine(u.x, u.y, this.x, this.y, tx, ty);
                if (distToLine < suppRadius && u !== t) { const falloff = 1 - (distToLine / suppRadius); u.applySuppression(suppPower * falloff); }
            });
        }
    }

    notifyAllyDeath(deadUnit, allUnits) {
        allUnits.forEach(ally => {
            if (ally.dead || ally.team !== deadUnit.team || ally === deadUnit) return;
            if (Math.hypot(ally.x - deadUnit.x, ally.y - deadUnit.y) < CONFIG.morale.allyDeathRadius) {
                ally.morale = Math.max(0, ally.morale - CONFIG.morale.decayAllyDeath);
                ally.combatStress = Math.min(100, ally.combatStress + 10);
            }
        });
    }

    findNearestCover(x, y, maxDist) {
        let bestPoint = null, bestDist = maxDist;
        for (const obs of obstacles) {
            if (obs.type === 'tree' || obs.type === 'bush') continue;
            const dx = x - obs.x, dy = y - obs.y;
            const dist = Math.hypot(dx, dy);
            if (dist > maxDist) continue;
            const halfW = obs.w / 2, halfH = obs.h / 2;
            const dirX = dx === 0 ? 0 : -dx / dist;
            const dirY = dy === 0 ? 0 : -dy / dist;
            const tX = dirX !== 0 ? halfW / Math.abs(dirX) : Infinity;
            const tY = dirY !== 0 ? halfH / Math.abs(dirY) : Infinity;
            const t = Math.min(tX, tY);
            const edgeX = obs.x + dirX * t;
            const edgeY = obs.y + dirY * t;
            const px = edgeX - dirX * 1.5;
            const py = edgeY - dirY * 1.5;
            const edgeDist = Math.hypot(px - x, py - y);
            if (edgeDist < bestDist) { bestDist = edgeDist; bestPoint = { x: px, y: py }; }
        }
        return bestPoint;
    }

    showDamageText(dmg) { damageTexts.push({ x: this.x, y: this.y - 10, text: `-${Math.round(dmg)}`, life: 1.0, color: '#ff4444' }); }

    distanceToLine(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1; const len = Math.hypot(dx, dy);
        if (len < 0.01) return Math.hypot(px - x1, py - y1);
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (len * len)));
        return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }

    findEnemy(allUnits) {
        let best = null, bestScore = -Infinity;
        for (const u of allUnits) {
            if (u.dead || u.team === this.team) continue;
            const d = this.distanceTo(u);
            let viewRange = CONFIG.viewRange;
            if (currentMapType === 'forest') viewRange *= 0.7;
            if (d > viewRange) continue;
            if (rayHitsObstacle(this.x, this.y, u.x, u.y)) continue;
            const priority = { mg: 3, grenadier: 2, commander: 2, squad_leader: 2, team_leader: 2, deputy: 2, at: 2, rifleman: 1, medic: 1, senior: 1, at_assist: 1, assistant_grenadier: 1, bmp_gunner: 1, bmp_driver: 1 };
            const p = priority[u.role] || 1;
            const score = p * 100 - d;
            if (score > bestScore) { bestScore = score; best = u; }
        }
        return best;
    }

    moveToward(tx, ty, dt) {
        const dx = tx - this.x, dy = ty - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.5) return;
        const stanceSpeed = CONFIG.stanceModifiers[this.stance].speedMult;
        const spd = CONFIG.speed * stanceSpeed * (this.team === 'RU' ? 1 : 1.03);
        const step = Math.min(dist, spd * dt);
        let nx = this.x + (dx / dist) * step;
        let ny = this.y + (dy / dist) * step;
        const obsX = pointInObstacle(nx, this.y, ['tree', 'bush']);
        const obsY = pointInObstacle(this.x, ny, ['tree', 'bush']);
        if (!obsX && !obsY) { this.x = nx; this.y = ny; }
        else if (!obsX) { this.x = nx; }
        else if (!obsY) { this.y = ny; }
        else {
            const perpAngle = Math.atan2(dy, dx) + Math.PI / 2;
            const sx = this.x + Math.cos(perpAngle) * step;
            const sy = this.y + Math.sin(perpAngle) * step;
            if (!pointInObstacle(sx, sy, ['tree', 'bush'])) { this.x = sx; this.y = sy; }
        }
        this.facing = Math.atan2(dy, dx);
        this.x = Math.max(4, Math.min(WORLD.width - 4, this.x));
        this.y = Math.max(4, Math.min(WORLD.height - 4, this.y));
    }

    autoSelectStance() {
        if (this.dead || this.suppressionLevel > 40) return;
        const isMoving = this.state === 'moving';
        const inCombat = this.target && this.distanceTo(this.target) <= this.weapon.maxRange;
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
        this.desiredStance = stance; this.stanceTimer = CONFIG.stanceSwitchTime; this.aimTimer = 0;
    }

    distanceTo(o) { return Math.hypot(o.x - this.x, o.y - this.y); }

    draw(ctx) {
        if (this.dead) {
            const alpha = Math.max(0.2, 1 - (performance.now() - this.deathTime) / 60000);
            ctx.fillStyle = `rgba(60, 40, 40, ${alpha})`;
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.facing + Math.PI/2);
            ctx.beginPath(); ctx.ellipse(0, 0, this.radius * 1.8, this.radius * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
            return;
        }
        const baseColor = this.team === 'RU' ? '#d52b1e' : '#3c6eb6';
        const isCommander = this.role === 'commander' || this.role === 'squad_leader';
        const isSelected = selectedUnits.includes(this);
        const mod = CONFIG.stanceModifiers[this.stance];
        const visualRadius = this.radius * Math.sqrt(mod.targetSizeMult);

        if (this.manualControl) {
            ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom]); ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2 / camera.zoom;
            ctx.beginPath(); ctx.arc(this.x, this.y, visualRadius + 6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        }
        if (this.suppressionLevel > 10) {
            const alpha = 0.2 + (this.suppressionLevel / 100) * 0.6;
            ctx.fillStyle = `rgba(180, 60, 255, ${alpha})`;
            ctx.beginPath(); ctx.arc(this.x, this.y, visualRadius + 6, 0, Math.PI * 2); ctx.fill();
        }
        if (isSelected) {
            ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.5 / camera.zoom;
            ctx.beginPath(); ctx.arc(this.x, this.y, visualRadius + 4, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(this.x + 1.5, this.y + 1.5, visualRadius, visualRadius * 0.7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = baseColor;

        if (this.stance === 'prone') {
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.facing);
            ctx.beginPath(); ctx.ellipse(0, 0, visualRadius * 1.6, visualRadius * 0.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        } else if (this.stance === 'crouch') {
            ctx.beginPath(); ctx.arc(this.x, this.y, visualRadius * 0.9, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.beginPath(); ctx.arc(this.x, this.y, visualRadius, 0, Math.PI * 2); ctx.fill();
        }
        if (isCommander) { ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.2 / camera.zoom; ctx.beginPath(); ctx.arc(this.x, this.y, visualRadius, 0, Math.PI * 2); ctx.stroke(); }
        ctx.strokeStyle = '#fff'; ctx.lineWidth = (this.stance === 'prone' ? 1.5 : 1.2) / camera.zoom;
        ctx.beginPath(); ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(this.facing) * (visualRadius + 3), this.y + Math.sin(this.facing) * (visualRadius + 3)); ctx.stroke();

        if (this.muzzleFlash > 0) {
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath(); ctx.arc(this.x + Math.cos(this.facing) * (visualRadius + 2), this.y + Math.sin(this.facing) * (visualRadius + 2), this.stance === 'prone' ? 3.5 : 2.5, 0, Math.PI * 2); ctx.fill();
        }
        const hpFrac = this.hp / this.maxHp;
        const barW = 12 / camera.zoom, barH = 2 / camera.zoom;
        if (hpFrac < 1) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(this.x - barW / 2, this.y - visualRadius - 6 / camera.zoom, barW, barH);
            ctx.fillStyle = hpFrac > 0.5 ? '#3c3' : hpFrac > 0.25 ? '#fc3' : '#f33';
            ctx.fillRect(this.x - barW / 2, this.y - visualRadius - 6 / camera.zoom, barW * hpFrac, barH);
        }
        if (this.morale < 100) {
            const moraleColor = this.morale > 70 ? '#3c3' : this.morale > 40 ? '#fc3' : this.morale > 20 ? '#f93' : '#f33';
            const moraleBarY = this.y - visualRadius - 10 / camera.zoom;
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(this.x - barW / 2, moraleBarY, barW, barH);
            ctx.fillStyle = moraleColor; ctx.fillRect(this.x - barW / 2, moraleBarY, barW * (this.morale / 100), barH);
        }
        if (this.isReloading) {
            const progress = 1 - (this.reloadTimer / (this.weapon.reloadTime || 3.0));
            ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2 / camera.zoom;
            ctx.beginPath(); ctx.arc(this.x, this.y, visualRadius + 6, -Math.PI/2, -Math.PI/2 + Math.PI * 2 * progress); ctx.stroke();
        }
        if (this.radioJamTimer > 0) {
            ctx.fillStyle = '#ff4444';
            ctx.font = `bold ${12 / camera.zoom}px sans-serif`; ctx.textAlign = 'center';
            ctx.fillText('📵', this.x, this.y - visualRadius - 18 / camera.zoom);
        }
        if (this.moraleState !== 'normal') {
            let icon = '';
            if (this.moraleState === 'cautious') icon = '⚠️';
            else if (this.moraleState === 'panicked') icon = '😱';
            else if (this.moraleState === 'routing') icon = '🏃';
            else if (this.moraleState === 'surrendered') icon = '🏳️';
            ctx.font = `bold ${12 / camera.zoom}px sans-serif`; ctx.textAlign = 'center';
            ctx.fillText(icon, this.x, this.y - visualRadius - 28 / camera.zoom);
        }
        if (this.aimLevel > 0.05 && (isSelected || camera.zoom > 1.5)) {
            const aimBarW = 16 / camera.zoom, aimBarH = 2 / camera.zoom;
            const bx = this.x - aimBarW / 2; const by = this.y - visualRadius - 14 / camera.zoom;
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx, by, aimBarW, aimBarH);
            ctx.fillStyle = this.aimLevel < 0.5 ? '#ffdd55' : this.aimLevel < 0.9 ? '#88dd55' : '#44ff44';
            ctx.fillRect(bx, by, aimBarW * this.aimLevel, aimBarH);
        }
    }
                                                  }
