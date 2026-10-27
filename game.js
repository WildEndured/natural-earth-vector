// ==================== КОНФИГУРАЦИЯ ====================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap');
const mctx = minimapCanvas.getContext('2d');
minimapCanvas.width = 180; minimapCanvas.height = 180;

let W = 0, H = 0;
function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; clampCamera(); }
window.addEventListener('resize', resize);

const WORLD = { width: 1000, height: 1000 };
const camera = { x: WORLD.width / 2, y: WORLD.height / 2, zoom: 0.8, minZoom: 0.3, maxZoom: 4.0, panSpeed: 800 };

// ==================== ЗВУК ====================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;
        if (type === 'shot') {
            osc.type = 'square'; osc.frequency.setValueAtTime(300 + Math.random()*100, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
            gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'mg') {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200 + Math.random()*50, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);
            gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.start(now); osc.stop(now + 0.08);
        } else if (type === 'explosion') {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(10, now + 0.5);
            gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            osc.start(now); osc.stop(now + 0.5);
        } else if (type === 'hit') {
            osc.type = 'sine'; osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
            gain.gain.setValueAtTime(0.03, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.start(now); osc.stop(now + 0.05);
        }
    } catch(e) {}
}

// ==================== ОРУЖИЕ ====================
const WEAPONS = {
    ak74m:    { name: 'АК-74М', caliber: '5.45×39 мм', weight: 3.6, magSize: 30, maxAmmo: 180, effRange: 300, maxRange: 1000, fireRate: 0.6, rpm: 650, muzzleVelocity: 900, damage: 28, baseAccuracy: 0.85, reloadTime: 2.5, suppressionPower: 0.5, icon: '🔫' },
    ak74m_gp: { name: 'АК-74М + ГП-25', caliber: '5.45 / 40 мм', weight: 4.8, magSize: 30, maxAmmo: 180, glAmmo: 4, glRange: 400, glBlast: 6, effRange: 300, maxRange: 1000, fireRate: 0.6, rpm: 650, muzzleVelocity: 900, damage: 28, baseAccuracy: 0.8, reloadTime: 3.0, hasGL: true, suppressionPower: 0.5, icon: '🔫💥' },
    pkm:      { name: 'ПКП «Печенег»', caliber: '7.62×54 мм R', weight: 12.7, magSize: 100, maxAmmo: 400, effRange: 800, maxRange: 1500, fireRate: 0.12, rpm: 650, muzzleVelocity: 825, damage: 22, baseAccuracy: 0.7, reloadTime: 12.0, suppressionPower: 1.5, bipod: true, icon: '💥' },
    rpg7:     { name: 'РПГ-7В', caliber: '85 мм', weight: 6.3, magSize: 1, maxAmmo: 4, effRange: 330, maxRange: 700, fireRate: 6.0, rpm: 6, muzzleVelocity: 120, damage: 150, baseAccuracy: 0.9, reloadTime: 8.0, isAntiTank: true, blastRadius: 6, suppressionPower: 2.0, icon: '🚀' },
    m4a1:     { name: 'M4A1', caliber: '5.56×45 NATO', weight: 3.4, magSize: 30, maxAmmo: 210, effRange: 300, maxRange: 800, fireRate: 0.55, rpm: 700, muzzleVelocity: 880, damage: 26, baseAccuracy: 0.85, reloadTime: 2.2, suppressionPower: 0.5, icon: '🔫' },
    m4a1_gl:  { name: 'M4A1 + M320', caliber: '5.56 / 40 мм', weight: 4.9, magSize: 30, maxAmmo: 210, glAmmo: 4, glRange: 400, glBlast: 5, effRange: 300, maxRange: 800, fireRate: 0.55, rpm: 700, muzzleVelocity: 880, damage: 26, baseAccuracy: 0.82, reloadTime: 3.0, hasGL: true, suppressionPower: 0.5, icon: '🔫💥' },
    m249:     { name: 'M249 SAW', caliber: '5.56×45 NATO', weight: 10.2, magSize: 200, maxAmmo: 600, effRange: 600, maxRange: 1000, fireRate: 0.1, rpm: 750, muzzleVelocity: 915, damage: 18, baseAccuracy: 0.75, reloadTime: 6.0, suppressionPower: 1.0, bipod: true, icon: '💥' },
    m110:     { name: 'M110 SASS', caliber: '7.62×51 NATO', weight: 7.8, magSize: 10, maxAmmo: 60, effRange: 800, maxRange: 1500, fireRate: 1.8, rpm: 30, muzzleVelocity: 837, damage: 65, baseAccuracy: 0.95, reloadTime: 4.0, suppressionPower: 0.7, bipod: true, icon: '🎯' }
};

const CONFIG = {
    soldierRadius: 4, speed: 8, viewRange: 350, objectiveRadius: 60,
    formationInterval: 7, marchColumnGap: 8,
    stanceSwitchTime: 0.8, autoStance: true,
    movingAccuracyPenalty: 0.5, stanceSwitchPenalty: 0.3, bipodBonus: 1.15,
    stanceModifiers: {
        stand:  { name: 'Стоя',     speedMult: 1.0,  hitChanceMod: 0.75, targetSizeMult: 1.0,  collisionMult: 1.0 },
        crouch: { name: 'С колена', speedMult: 0.6,  hitChanceMod: 1.0,  targetSizeMult: 0.7,  collisionMult: 0.8 },
        prone:  { name: 'Лёжа',     speedMult: 0.35, hitChanceMod: 1.3,  targetSizeMult: 0.45, collisionMult: 0.5 }
    },
    aimTime: 2.0, aimBonusStandard: 0.25, aimBonusSniper: 0.35, aimBonusMG: 0.30,
    suppressionRadius: 15, suppressionDecay: 15, suppressionRecovery: 2.0, suppressionAccuracyPenalty: 0.35, suppressionMGMultiplier: 1.8,
    morale: {
        decaySuppression: 5, decayWounded: 2, decayAllyDeath: 10, decayLeaderLoss: 25, decayCombatStress: 1,
        regenBase: 2, regenLeaderNearby: 2.0, regenNoSuppression: 1.5,
        combatStressGain: 2, combatStressDecay: 3, combatStressThreshold: 60,
        thresholds: { cautious: 70, panicked: 40, routing: 20, surrendered: 10 },
        leaderRadius: 30, allyDeathRadius: 50
    }
};

const USGroups = {
    A: 'fire', B: 'maneuver', roleNames: { fire: 'огонь', maneuver: 'маневр' },
    reset() { this.A = 'fire'; this.B = 'maneuver'; },
    evaluateAndSwitch(usUnits) {
        const aliveA = usUnits.filter(u => !u.dead && u.groupId === 'A');
        const aliveB = usUnits.filter(u => !u.dead && u.groupId === 'B');
        if (this.A === 'fire' && aliveA.length < 2 && aliveB.length >= 2) { this.A = 'maneuver'; this.B = 'fire'; showStatus('🇺🇸 А→маневр, Б→огонь'); }
        else if (this.B === 'fire' && aliveB.length < 2 && aliveA.length >= 2) { this.B = 'maneuver'; this.A = 'fire'; showStatus('🇺🇸 Б→маневр, А→огонь'); }
        const el = document.getElementById('us-groups');
        if (el) el.textContent = `А: ${this.roleNames[this.A]} · Б: ${this.roleNames[this.B]}`;
    }
};

// ==================== ЛАНДШАФТ ====================
const obstacles = []; const decorations = []; let currentMapType = 'open';

function generateMap(type) {
    currentMapType = type; obstacles.length = 0; decorations.length = 0;
    if (type === 'open') {
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2; const dist = 100 + Math.random() * 50;
            obstacles.push({ type: 'wall', x: WORLD.width/2 + Math.cos(angle) * dist, y: WORLD.height/2 + Math.sin(angle) * dist, w: 30 + Math.random()*20, h: 10 + Math.random()*10, rotation: 0 });
        }
        obstacles.push({ type: 'house', x: 300, y: 300, w: 60, h: 60, rotation: 0 });
        obstacles.push({ type: 'house', x: 700, y: 700, w: 60, h: 60, rotation: 0 });
    } else if (type === 'forest') {
        for (let i = 0; i < 70; i++) obstacles.push({ type: 'tree', x: 100 + Math.random() * (WORLD.width - 200), y: 100 + Math.random() * (WORLD.height - 200), w: 12 + Math.random()*8, h: 12 + Math.random()*8, rotation: 0 });
        for (let i = 0; i < 40; i++) decorations.push({ type: 'bush', x: 100 + Math.random() * (WORLD.width - 200), y: 100 + Math.random() * (WORLD.height - 200), r: 8 + Math.random()*6 });
    } else if (type === 'city') {
        const b = [{x: 200, y: 200, w: 80, h: 60}, {x: 500, y: 150, w: 70, h: 90}, {x: 800, y: 250, w: 90, h: 70}, {x: 250, y: 500, w: 60, h: 100}, {x: 750, y: 550, w: 80, h: 80}, {x: 450, y: 750, w: 70, h: 60}, {x: 150, y: 800, w: 100, h: 50}, {x: 850, y: 800, w: 60, h: 100}];
        b.forEach(pos => obstacles.push({ type: 'house', ...pos, rotation: 0 }));
        for (let i = 0; i < 8; i++) obstacles.push({ type: 'car', x: 100 + Math.random() * (WORLD.width - 200), y: 100 + Math.random() * (WORLD.height - 200), w: 25, h: 12, rotation: 0, hp: 100 });
        for (let i = 0; i < 10; i++) obstacles.push({ type: 'wall', x: 100 + Math.random() * (WORLD.width - 200), y: 100 + Math.random() * (WORLD.height - 200), w: 30, h: 10, rotation: 0 });
    }
}

function rayHitsObstacle(x1, y1, x2, y2) {
    for (const obs of obstacles) {
        if (obs.type === 'tree') continue;
        const minX = obs.x - obs.w/2, maxX = obs.x + obs.w/2, minY = obs.y - obs.h/2, maxY = obs.y + obs.h/2;
        let t0 = 0, t1 = 1; const dx = x2 - x1, dy = y2 - y1;
        const p = [-dx, dx, -dy, dy]; const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];
        let intersects = true;
        for (let i = 0; i < 4; i++) {
            if (p[i] === 0) { if (q[i] < 0) { intersects = false; break; } }
            else {
                const r = q[i] / p[i];
                if (p[i] < 0) { if (r > t1) { intersects = false; break; } if (r > t0) t0 = r; }
                else { if (r < t0) { intersects = false; break; } if (r < t1) t1 = r; }
            }
        }
        if (intersects && t0 < t1) return obs;
    }
    return null;
}

function pointInObstacle(x, y, skipTypes = []) {
    for (const obs of obstacles) {
        if (skipTypes.includes(obs.type)) continue;
        if (x > obs.x - obs.w/2 && x < obs.x + obs.w/2 && y > obs.y - obs.h/2 && y < obs.y + obs.h/2) return obs;
    }
    return null;
}

// ==================== ПОСТРОЕНИЯ ====================
const Formation = {
    current: 'march',
    reset() { this.current = 'march'; },
    apply(commander) {
        if (!commander || commander.dead) return;
        let dir = commander.facing;
        if (commander.moveTarget) dir = Math.atan2(commander.moveTarget.y - commander.y, commander.moveTarget.x - commander.x);
        const alive = ruUnits.filter(u => !u.dead); const followers = alive.filter(u => u !== commander);
        followers.sort((a, b) => a.roleName.localeCompare(b.roleName)); const total = followers.length;
        if (this.current === 'march') {
            const backAngle = dir + Math.PI;
            followers.forEach((u, i) => {
                const distBack = (i + 1) * CONFIG.marchColumnGap; const lateralOffset = (i % 2 === 0 ? 1 : -1) * 2;
                const px = commander.x + Math.cos(backAngle) * distBack + Math.cos(backAngle + Math.PI/2) * lateralOffset;
                const py = commander.y + Math.sin(backAngle) * distBack + Math.sin(backAngle + Math.PI/2) * lateralOffset;
                u.moveTarget = { x: px, y: py }; u.followTarget = null; u.holding = false; u.formationPos = { x: px, y: py };
            });
        } else {
            const perpAngle = dir + Math.PI / 2;
            followers.forEach((u, i) => {
                const idx = i - (total - 1) / 2; const lateral = idx * CONFIG.formationInterval; const backOffset = 4;
                const px = commander.x + Math.cos(perpAngle) * lateral + Math.cos(dir + Math.PI) * backOffset;
                const py = commander.y + Math.sin(perpAngle) * lateral + Math.sin(dir + Math.PI) * backOffset;
                u.moveTarget = { x: px, y: py }; u.followTarget = null; u.holding = false; u.formationPos = { x: px, y: py };
            });
        }
    }
};

// ==================== КЛАСС SOLDIER ====================
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
    }

    update(dt, allUnits) {
        if (this.dead) return;
        this.currentObstacle = pointInObstacle(this.x, this.y);
        if (this.panicTimer > 0) this.panicTimer -= dt;

        // Подавление
        if (this.suppressionLevel > 0) {
            this.suppressionLevel = Math.max(0, this.suppressionLevel - dt * CONFIG.suppressionDecay);
            this.suppressionTimer = Math.max(0, this.suppressionTimer - dt);
            this.suppressionFlash = Math.max(0, this.suppressionFlash - dt);
        }
        if (this.suppressionLevel > 10 && this.suppressionLevel <= 40 && this.recoveryTimer <= 0) this.recoveryTimer = CONFIG.suppressionRecovery;
        if (this.recoveryTimer > 0) this.recoveryTimer -= dt;

        // Мораль
        this.updateMorale(dt, allUnits);
        if (this.moraleState === 'surrendered') { this.state = 'surrendered'; this.moveTarget = null; this.holding = false; this.target = null; this.setStance('stand'); return; }
        if (this.moraleState === 'routing') {
            this.suppressionLevel = 0; this.suppressionTimer = 0;
            const enemy = this.findEnemy(allUnits);
            if (enemy) {
                const fleeAngle = Math.atan2(this.y - enemy.y, this.x - enemy.x);
                this.state = 'routing'; this.setStance('stand'); this.facing = fleeAngle;
                this.moveToward(this.x + Math.cos(fleeAngle) * 100, this.y + Math.sin(fleeAngle) * 100, dt);
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

        // Сильное подавление
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

        // Перезарядка
        if (this.isReloading) {
            const speedMult = this.suppressionLevel > 40 ? 0.5 : 1.0;
            this.reloadTimer -= dt * speedMult;
            if (this.reloadTimer <= 0) this.isReloading = false;
            return;
        }

        this.cooldown = Math.max(0, this.cooldown - dt);
        if (this.muzzleFlash > 0) this.muzzleFlash -= dt;
        if (this.stance !== this.desiredStance) { this.stanceTimer -= dt; if (this.stanceTimer <= 0) this.stance = this.desiredStance; }

        // Подавление пулемётом
        if (this.isSuppressing && this.suppressionTargetPos) {
            this.setStance('prone');
            this.facing = Math.atan2(this.suppressionTargetPos.y - this.y, this.suppressionTargetPos.x - this.x);
            if (this.cooldown <= 0 && !this.isReloading) this.fireSuppression();
            return;
        }

        // Поиск цели
        this.target = this.findEnemy(allUnits);

        // Прицеливание (после findEnemy)
        const physicallyMoving = Math.hypot(this.x - this.lastX, this.y - this.lastY) > 0.05;
        this.lastX = this.x; this.lastY = this.y;
        const canAim = this.target && !physicallyMoving && this.state !== 'moving'
                       && this.suppressionLevel <= 40 && !this.isReloading
                       && this.stance === this.desiredStance;
        if (canAim) this.aimTimer = Math.min(CONFIG.aimTime, this.aimTimer + dt);
        else this.aimTimer = Math.max(0, this.aimTimer - dt * 3);
        const aimT = this.aimTimer / CONFIG.aimTime;
        this.aimLevel = aimT * aimT * (3 - 2 * aimT);

        // Стойка
        if (CONFIG.autoStance && !this.stanceLocked) this.autoSelectStance();

        // Поведение
        if (this.target && this.distanceTo(this.target) <= this.weapon.maxRange) {
            this.state = 'attacking';
            this.facing = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            if (this.distanceTo(this.target) <= this.weapon.effRange) {
                if (this.cooldown <= 0) this.fire();
            } else if (!this.holding && !this.moveTarget) this.moveToward(this.target.x, this.target.y, dt);
        } else if (this.holding) this.state = 'holding';
        else if (this.moveTarget) {
            this.state = 'moving';
            this.moveToward(this.moveTarget.x, this.moveTarget.y, dt);
            if (this.distanceTo(this.moveTarget) < 4) this.moveTarget = null;
        } else if (this.formationPos && !this.target) {
            const d = Math.hypot(this.formationPos.x - this.x, this.formationPos.y - this.y);
            if (d > 3) { this.state = 'moving'; this.moveToward(this.formationPos.x, this.formationPos.y, dt); }
            else this.state = 'idle';
        } else if (this.followTarget && !this.followTarget.dead) {
            const d = this.distanceTo(this.followTarget);
            if (d > 20) { this.moveToward(this.followTarget.x, this.followTarget.y, dt); this.state = 'moving'; }
            else this.state = 'idle';
        } else this.state = 'idle';
    }

    updateMorale(dt, allUnits) {
        if (this.dead) return;
        if (this.hp < 50) this.morale -= CONFIG.morale.decayWounded * dt;
        if (this.suppressionLevel > 40) this.morale -= CONFIG.morale.decaySuppression * dt;
        const enemyNear = allUnits.some(u => !u.dead && u.team !== this.team && this.distanceTo(u) < CONFIG.viewRange);
        if (enemyNear) this.combatStress = Math.min(100, this.combatStress + CONFIG.morale.combatStressGain * dt);
        else this.combatStress = Math.max(0, this.combatStress - CONFIG.morale.combatStressDecay * dt);
        if (this.combatStress > CONFIG.morale.combatStressThreshold) this.morale -= CONFIG.morale.decayCombatStress * dt;
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
        if (this.ammo <= 0) { this.isReloading = true; this.reloadTimer = this.weapon.reloadTime || 3.0; this.isSuppressing = false; return; }
        this.ammo--; this.cooldown = this.fireRate; this.muzzleFlash = 0.06; playSound('mg');
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
        if (this.weaponId === 'pkm' || this.weaponId === 'm249') playSound('mg'); else if (!isGL) playSound('shot');

        const t = this.target; if (!t || t.dead) return;
        const dist = this.distanceTo(t); const isExplosive = this.weapon.isAntiTank || isGL;

        if (isExplosive) {
            playSound('explosion');
            const blastRadius = isGL ? (this.weapon.glBlast || 5) : (this.weapon.isAntiTank ? (this.weapon.blastRadius || 8) : 8);
            let hitX = t.x, hitY = t.y;
            if (this.weapon.isAntiTank) { hitX += (Math.random()-0.5)*15; hitY += (Math.random()-0.5)*15; }
            if (dist > this.weapon.effRange) { const scatter = (dist - this.weapon.effRange) / 2; hitX += (Math.random()-0.5)*scatter; hitY += (Math.random()-0.5)*scatter; }
            allUnits.forEach(u => {
                if (u.dead || u.team === this.team) return;
                const d = Math.hypot(u.x - hitX, u.y - hitY);
                if (d < blastRadius) {
                    const falloff = 1 - (d / blastRadius);
                    const dmg = (isGL ? 80 : this.damage) * falloff;
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
                playSound('hit');
                const dmg = this.damage * (0.9 + Math.random() * 0.2);
                t.hp -= dmg; t.showDamageText(dmg);
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
        let best = null, bestDist = maxDist;
        for (const obs of obstacles) {
            if (obs.type === 'tree' || obs.type === 'bush') continue;
            const d = Math.hypot(obs.x - x, obs.y - y) - Math.max(obs.w, obs.h) / 2;
            if (d < bestDist) { bestDist = d; best = obs; }
        }
        return best ? { x: best.x, y: best.y } : null;
    }

    showDamageText(dmg) { damageTexts.push({ x: this.x, y: this.y - 10, text: `-${Math.round(dmg)}`, life: 1.0, color: '#ff4444' }); }

    distanceToLine(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1; const len = Math.hypot(dx, dy);
        if (len < 0.01) return Math.hypot(px - x1, py - y1);
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (len * len)));
        return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }

    findEnemy(allUnits) {
        let best = null, bestDist = Infinity;
        for (const u of allUnits) {
            if (u.dead || u.team === this.team) continue;
            const d = this.distanceTo(u);
            let viewRange = CONFIG.viewRange;
            if (currentMapType === 'forest') viewRange *= 0.7;
            if (d < viewRange && d < bestDist && !rayHitsObstacle(this.x, this.y, u.x, u.y)) { bestDist = d; best = u; }
        }
        return best;
    }

    // === ИСПРАВЛЕНО: скольжение при застревании на углах ===
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
            // Скольжение по перпендикуляру
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
        if (this.moraleState !== 'normal') {
            let icon = ''; if (this.moraleState === 'cautious') icon = '⚠️'; else if (this.moraleState === 'panicked') icon = '😱'; else if (this.moraleState === 'routing') icon = '🏃'; else if (this.moraleState === 'surrendered') icon = '🏳️';
            ctx.font = `bold ${12 / camera.zoom}px sans-serif`; ctx.textAlign = 'center';
            ctx.fillText(icon, this.x, this.y - visualRadius - 18 / camera.zoom);
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

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let ruUnits = [], usUnits = [], allUnits = [], selectedUnits = [], bullets = [], explosions = [], damageTexts = [];
let objective = { x: 0, y: 0, radius: CONFIG.objectiveRadius, owner: 'neutral', holdTime: 0 };
let gameTime = 0, gameOver = false, orderMode = 'move';
let globalAIMode = true;

function createRussianSquad(cx, cy) {
    return [
        new Soldier(cx, cy, 'RU', 'commander', 'Ком. отделения', 'ak74m', 'cmd'),
        new Soldier(cx + 12, cy + 10, 'RU', 'deputy', 'Зам. ком. (ст. стрелок)', 'ak74m_gp', 'cmd'),
        new Soldier(cx + 24, cy + 18, 'RU', 'mg', 'Пулеметчик', 'pkm', 'fire'),
        new Soldier(cx + 6, cy + 24, 'RU', 'grenadier', 'Гранатометчик', 'rpg7', 'fire'),
        new Soldier(cx - 6, cy + 24, 'RU', 'assistant_grenadier', 'Пом. гранатометчика', 'ak74m', 'fire'),
        new Soldier(cx - 18, cy + 18, 'RU', 'rifleman', 'Стрелок', 'ak74m', 'maneuver'),
        new Soldier(cx - 24, cy + 10, 'RU', 'rifleman', 'Стрелок', 'ak74m', 'maneuver'),
        new Soldier(cx - 12, cy + 10, 'RU', 'medic', 'Санитар-стрелок', 'ak74m', 'maneuver'),
        new Soldier(cx, cy + 32, 'RU', 'bmp_gunner', 'Наводчик-оператор БМП', 'ak74m', 'crew'),
        new Soldier(cx + 10, cy + 32, 'RU', 'bmp_driver', 'Механик-водитель БМП', 'ak74m', 'crew'),
    ];
}

function createUSSquad(cx, cy) {
    return [
        new Soldier(cx, cy, 'US', 'squad_leader', 'Ком. отделения', 'm4a1', 'cmd'),
        new Soldier(cx + 15, cy + 8, 'US', 'team_leader', 'Ком. группы А', 'm4a1_gl', 'A'),
        new Soldier(cx + 22, cy + 16, 'US', 'mg', 'Пулеметчик А', 'm249', 'A'),
        new Soldier(cx + 8, cy + 16, 'US', 'grenadier', 'Гренадер А', 'm4a1_gl', 'A'),
        new Soldier(cx + 30, cy + 24, 'US', 'rifleman', 'Стрелок А', 'm4a1', 'A'),
        new Soldier(cx - 15, cy + 8, 'US', 'team_leader', 'Ком. группы Б', 'm4a1_gl', 'B'),
        new Soldier(cx - 22, cy + 16, 'US', 'mg', 'Пулеметчик Б', 'm249', 'B'),
        new Soldier(cx - 8, cy + 16, 'US', 'grenadier', 'Гренадер Б', 'm4a1_gl', 'B'),
        new Soldier(cx - 30, cy + 24, 'US', 'rifleman', 'Стрелок Б', 'm4a1', 'B'),
    ];
}

// === ИСПРАВЛЕНО: полный сброс состояния ===
function init() {
    // Сброс глобального состояния
    USGroups.reset();
    Formation.reset();
    globalAIMode = true;
    bullets = []; explosions = []; damageTexts = [];
    gameTime = 0; gameOver = false;
    
    resize();
    ruUnits = createRussianSquad(150, 850);
    usUnits = createUSSquad(850, 150);
    allUnits = [...ruUnits, ...usUnits];
    objective = { x: WORLD.width / 2, y: WORLD.height / 2, radius: CONFIG.objectiveRadius, owner: 'neutral', holdTime: 0 };
    selectedUnits = [ruUnits[0]];
    for (let i = 1; i < ruUnits.length; i++) ruUnits[i].followTarget = ruUnits[0];
    const fitZoom = Math.min(W / WORLD.width, H / WORLD.height) * 0.95;
    camera.zoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, fitZoom));
    camera.x = WORLD.width / 2; camera.y = WORLD.height / 2;
    clampCamera(); updateUI();
    
    // Сброс UI-кнопки ИИ
    const aiBtn = document.getElementById('btn-ai-mode');
    if (aiBtn) { aiBtn.textContent = 'ИИ: ВКЛ'; aiBtn.style.background = '#4a3a6a'; }
}

function resolveCollisions() {
    for (let i = 0; i < allUnits.length; i++) {
        const a = allUnits[i]; if (a.dead) continue;
        for (let j = i + 1; j < allUnits.length; j++) {
            const b = allUnits[j]; if (b.dead) continue;
            const dx = b.x - a.x, dy = b.y - a.y; const distSq = dx * dx + dy * dy;
            const rA = a.radius * CONFIG.stanceModifiers[a.stance].collisionMult;
            const rB = b.radius * CONFIG.stanceModifiers[b.stance].collisionMult;
            const minDist = rA + rB + 1.5; const minDistSq = minDist * minDist;
            if (distSq < minDistSq && distSq > 0.001) {
                const dist = Math.sqrt(distSq); const overlap = (minDist - dist) / 2;
                const nx = dx / dist, ny = dy / dist;
                a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
            }
        }
    }
}

function screenToWorld(sx, sy) { return { x: (sx - W / 2) / camera.zoom + camera.x, y: (sy - H / 2) / camera.zoom + camera.y }; }
function worldToScreen(wx, wy) { return { x: (wx - camera.x) * camera.zoom + W / 2, y: (wy - camera.y) * camera.zoom + H / 2 }; }
function clampCamera() {
    if (!W || !H) return;
    const halfW = (W / 2) / camera.zoom, halfH = (H / 2) / camera.zoom;
    if (WORLD.width * camera.zoom < W) camera.x = WORLD.width / 2;
    else camera.x = Math.max(halfW, Math.min(WORLD.width - halfW, camera.x));
    if (WORLD.height * camera.zoom < H) camera.y = WORLD.height / 2;
    else camera.y = Math.max(halfH, Math.min(WORLD.height - halfH, camera.y));
}
function zoomAt(sx, sy, factor) {
    const before = screenToWorld(sx, sy);
    camera.zoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, camera.zoom * factor));
    const after = screenToWorld(sx, sy);
    camera.x += before.x - after.x; camera.y += before.y - after.y; clampCamera();
}

// ==================== ИИ ====================
function updateSquadAI(dt, units, isRussian) {
    const alive = units.filter(u => !u.dead); if (alive.length === 0) return;
    if (!isRussian) USGroups.evaluateAndSwitch(units);
    let leader = alive.find(u => u.role === 'commander' || u.role === 'squad_leader');
    if (!leader) {
        leader = alive[0]; leader.role = isRussian ? 'commander' : 'squad_leader'; leader.roleName = 'И.о. ком. отделения';
        alive.forEach(u => { u.panicTimer = 3.0; u.morale = Math.max(0, u.morale - CONFIG.morale.decayLeaderLoss); u.combatStress = Math.min(100, u.combatStress + 20); });
        showStatus(isRussian ? '🇷🇺 Потерян командир!' : '🇺🇸 Потерян командир!');
    }
    if (leader.manualControl) return;
    let groupLeaders = { A: null, B: null };
    if (!isRussian) {
        ['A', 'B'].forEach(g => {
            let gl = alive.find(u => u.groupId === g && u.role === 'team_leader');
            if (!gl) { const cands = alive.filter(u => u.groupId === g); if (cands.length) { gl = cands[0]; gl.role = 'team_leader'; gl.roleName = `И.о. ком. ${g}`; } }
            groupLeaders[g] = gl;
        });
    } else {
        groupLeaders.fire = alive.find(u => u.groupId === 'fire' && u.role !== 'commander') || null;
        groupLeaders.maneuver = alive.find(u => u.groupId === 'maneuver' && u.role !== 'commander') || null;
    }
    if (leader && !leader.target && !leader.manualControl) leader.moveTarget = { x: objective.x, y: objective.y };
    if (isRussian) {
        const mg = alive.find(u => u.role === 'mg');
        if (mg && !mg.target && !mg.manualControl && objective.owner !== 'RU') { mg.isSuppressing = true; mg.suppressionTargetPos = { x: objective.x, y: objective.y }; }
        const fl = groupLeaders.fire; const ml = groupLeaders.maneuver;
        if (fl && !fl.target && !fl.manualControl) {
            if (!fl._firePos) fl._firePos = { x: objective.x + 150, y: objective.y - 150 };
            if (!fl.moveTarget && !fl._reachedFirePos) { fl.moveTarget = { ...fl._firePos }; if (Math.hypot(fl.x - fl._firePos.x, fl.y - fl._firePos.y) < 30) { fl._reachedFirePos = true; fl.moveTarget = null; fl.holding = true; } }
        }
        if (ml && !ml.target && !ml.manualControl) {
            if (!ml._maneuverPos) ml._maneuverPos = { x: objective.x - 80, y: objective.y + 80 };
            if (!ml.moveTarget && !ml._reachedManeuver) { ml.moveTarget = { ...ml._maneuverPos }; if (Math.hypot(ml.x - ml._maneuverPos.x, ml.y - ml._maneuverPos.y) < 25) { ml._reachedManeuver = true; ml.moveTarget = { x: objective.x, y: objective.y }; } }
        }
    } else {
        ['A', 'B'].forEach(gid => {
            const gl = groupLeaders[gid]; if (!gl || gl.target || gl.manualControl) return;
            const role = USGroups[gid];
            if (role === 'fire') {
                if (!gl._firePos) { const angle = gid === 'A' ? -Math.PI/4 : Math.PI/4; gl._firePos = { x: objective.x + Math.cos(angle) * 150, y: objective.y + Math.sin(angle) * 150 }; }
                if (!gl.moveTarget && !gl._reachedFirePos) { gl.moveTarget = { ...gl._firePos }; if (Math.hypot(gl.x - gl._firePos.x, gl.y - gl._firePos.y) < 30) { gl._reachedFirePos = true; gl.moveTarget = null; gl.holding = true; } }
            } else {
                if (!gl._maneuverPos) { const angle = gid === 'A' ? -Math.PI/3 : Math.PI/3; gl._maneuverPos = { x: objective.x + Math.cos(angle) * 80, y: objective.y + Math.sin(angle) * 80 }; }
                if (!gl.moveTarget && !gl._reachedManeuver) { gl.moveTarget = { ...gl._maneuverPos }; if (Math.hypot(gl.x - gl._maneuverPos.x, gl.y - gl._maneuverPos.y) < 25) { gl._reachedManeuver = true; gl.moveTarget = { x: objective.x, y: objective.y }; } }
            }
        });
    }
    alive.forEach(u => {
        if (u === leader || u.manualControl) return;
        if (isRussian) {
            const gid = u.groupId || 'maneuver'; const gl = gid === 'fire' ? groupLeaders.fire : groupLeaders.maneuver;
            if (gl && !gl.dead && !gl.manualControl) { const d = Math.hypot(gl.x - u.x, gl.y - u.y); if (d > 25) u.moveTarget = { x: gl.x + (Math.random()-0.5)*15, y: gl.y + (Math.random()-0.5)*15 }; else { u.moveTarget = null; u.followTarget = gl; } }
        } else {
            const gid = u.groupId || 'A'; const gl = groupLeaders[gid];
            if (gl && !gl.dead && !gl.manualControl) { const d = Math.hypot(gl.x - u.x, gl.y - u.y); if (d > 25) u.moveTarget = { x: gl.x + (Math.random()-0.5)*15, y: gl.y + (Math.random()-0.5)*15 }; else { u.moveTarget = null; u.followTarget = gl; } }
        }
    });
    const sniper = alive.find(u => u.weaponId === 'm110');
    if (sniper && leader && !sniper._hasSniperPos && !sniper.manualControl) { const backAngle = leader.facing + Math.PI; sniper.moveTarget = { x: leader.x + Math.cos(backAngle) * 40, y: leader.y + Math.sin(backAngle) * 40 }; sniper._hasSniperPos = true; }
    if (sniper && !sniper.manualControl) {
        if (sniper.target && !sniper.target.dead) { sniper.moveTarget = null; sniper.holding = true; }
        else { sniper.holding = false; }
    }
}

function updateUSAI(dt) { updateSquadAI(dt, usUnits, false); }
function updateRUAI(dt) { updateSquadAI(dt, ruUnits, true); }

// ==================== ОБНОВЛЕНИЕ ====================
function update(dt) {
    if (gameOver) return;
    gameTime += dt;
    const pan = (camera.panSpeed / camera.zoom) * dt;
    if (keys['a'] || keys['arrowleft']) camera.x -= pan;
    if (keys['d'] || keys['arrowright']) camera.x += pan;
    if (keys['w'] || keys['arrowup']) camera.y -= pan;
    if (keys['s'] || keys['arrowdown']) camera.y += pan;
    if (camBtnState.up) camera.y -= pan; if (camBtnState.down) camera.y += pan;
    clampCamera();

    updateUSAI(dt); updateRUAI(dt);
    allUnits.forEach(u => u.update(dt, allUnits));
    resolveCollisions();
    bullets.forEach(b => b.life -= dt); bullets = bullets.filter(b => b.life > 0);
    explosions.forEach(e => e.life -= dt); explosions = explosions.filter(e => e.life > 0);
    damageTexts.forEach(t => { t.y -= 20 * dt; t.life -= dt; }); damageTexts = damageTexts.filter(t => t.life > 0);
    checkObjective(dt);
    const ruAlive = ruUnits.filter(u => !u.dead).length;
    const usAlive = usUnits.filter(u => !u.dead).length;
    if (ruAlive === 0) endGame('US'); else if (usAlive === 0) endGame('RU');
    updateUI();
}

function checkObjective(dt) {
    const ruNear = ruUnits.filter(u => !u.dead && Math.hypot(u.x - objective.x, u.y - objective.y) < objective.radius).length;
    const usNear = usUnits.filter(u => !u.dead && Math.hypot(u.x - objective.x, u.y - objective.y) < objective.radius).length;
    if (ruNear > 0 && usNear === 0) { if (objective.owner !== 'RU') { objective.holdTime += dt; if (objective.holdTime > 3) { objective.owner = 'RU'; objective.holdTime = 0; } } }
    else if (usNear > 0 && ruNear === 0) { if (objective.owner !== 'US') { objective.holdTime += dt; if (objective.holdTime > 3) { objective.owner = 'US'; objective.holdTime = 0; } } }
    else objective.holdTime = Math.max(0, objective.holdTime - dt);
}

function endGame(team) { gameOver = true; document.getElementById('game-over').classList.remove('hidden'); document.getElementById('result-text').textContent = team === 'RU' ? '🏆 Победа России!' : '🏆 Победа США!'; }

function updateUI() {
    const ruAlive = ruUnits.filter(u => !u.dead).length; const usAlive = usUnits.filter(u => !u.dead).length;
    document.getElementById('ru-count').textContent = `Живых: ${ruAlive}/${ruUnits.length}`;
    document.getElementById('us-count').textContent = `Живых: ${usAlive}/${usUnits.length}`;
    const statusText = { neutral: 'нейтральна', RU: '🇷🇺 РФ', US: '🇺🇸 США' }[objective.owner];
    document.getElementById('objective-status').textContent = `(${statusText})`;
    const min = Math.floor(gameTime / 60).toString().padStart(2, '0'); const sec = Math.floor(gameTime % 60).toString().padStart(2, '0');
    document.getElementById('mission-timer').textContent = `${min}:${sec}`;
    updateSelectedUI();
}

// ==================== РЕНДЕР ====================
function draw() {
    if (currentMapType === 'forest') ctx.fillStyle = '#1e2e1a';
    else if (currentMapType === 'city') ctx.fillStyle = '#2a2a2a';
    else ctx.fillStyle = '#2d3a2e';
    ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(camera.zoom, camera.zoom); ctx.translate(-camera.x, -camera.y);
    ctx.fillStyle = currentMapType === 'forest' ? '#2a3a24' : currentMapType === 'city' ? '#333' : '#33422f';
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1 / camera.zoom;
    for (let x = 0; x <= WORLD.width; x += 100) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.height); ctx.stroke(); }
    for (let y = 0; y <= WORLD.height; y += 100) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.width, y); ctx.stroke(); }
    ctx.strokeStyle = '#777'; ctx.lineWidth = 3 / camera.zoom; ctx.strokeRect(0, 0, WORLD.width, WORLD.height);

    ctx.beginPath(); ctx.arc(objective.x, objective.y, objective.radius, 0, Math.PI * 2);
    ctx.fillStyle = objective.owner === 'RU' ? 'rgba(213,43,30,0.25)' : objective.owner === 'US' ? 'rgba(60,110,182,0.25)' : 'rgba(255,215,0,0.15)';
    ctx.fill();
    ctx.strokeStyle = objective.owner === 'RU' ? '#d52b1e' : objective.owner === 'US' ? '#3c6eb6' : '#ffd700';
    ctx.lineWidth = 2 / camera.zoom; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `bold ${20 / camera.zoom}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★', objective.x, objective.y);
    if (objective.holdTime > 0) { const frac = Math.min(1, objective.holdTime / 3); ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3 / camera.zoom; ctx.beginPath(); ctx.arc(objective.x, objective.y, objective.radius + 8 / camera.zoom, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke(); }

    decorations.forEach(d => {
        if (d.type === 'blood') { ctx.fillStyle = `rgba(120, 0, 0, 0.6)`; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill(); }
        else if (d.type === 'bulletmark') { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill(); }
        else if (d.type === 'bush') { ctx.fillStyle = '#1f401f'; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill(); }
    });

    obstacles.forEach(obs => {
        ctx.save(); ctx.translate(obs.x, obs.y); ctx.rotate(obs.rotation || 0);
        if (obs.type === 'wall') { ctx.fillStyle = '#8B7355'; ctx.fillRect(-obs.w/2, -obs.h/2, obs.w, obs.h); ctx.strokeStyle = '#5a4a35'; ctx.lineWidth = 2 / camera.zoom; ctx.strokeRect(-obs.w/2, -obs.h/2, obs.w, obs.h); }
        else if (obs.type === 'house') { ctx.fillStyle = '#5a5a5a'; ctx.fillRect(-obs.w/2, -obs.h/2, obs.w, obs.h); ctx.strokeStyle = '#222'; ctx.lineWidth = 2 / camera.zoom; ctx.strokeRect(-obs.w/2, -obs.h/2, obs.w, obs.h); ctx.fillStyle = '#777'; ctx.fillRect(-obs.w/4, -obs.h/4, obs.w/2, obs.h/2); }
        else if (obs.type === 'tree') { ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(0, 0, obs.w * 0.4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#2a5a2a'; ctx.beginPath(); ctx.arc(0, 0, obs.w, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#1a3a1a'; ctx.lineWidth = 1 / camera.zoom; ctx.stroke(); }
        else if (obs.type === 'car') { ctx.fillStyle = obs.hp > 50 ? '#4a6a8a' : '#3a3a3a'; ctx.fillRect(-obs.w/2, -obs.h/2, obs.w, obs.h); ctx.strokeStyle = '#222'; ctx.lineWidth = 1 / camera.zoom; ctx.strokeRect(-obs.w/2, -obs.h/2, obs.w, obs.h); }
        ctx.restore();
    });

    bullets.forEach(b => { ctx.strokeStyle = b.color; ctx.lineWidth = (b.isRPG ? 3 : 1.5) / camera.zoom; ctx.beginPath(); ctx.moveTo(b.x, b.y); const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy) || 1; ctx.lineTo(b.x + (dx / d) * (b.isRPG ? 60 : 40), b.y + (dy / d) * (b.isRPG ? 60 : 40)); ctx.stroke(); });

    explosions.forEach(e => { const alpha = e.life / 0.5; ctx.fillStyle = `rgba(255, 100, 0, ${alpha * 0.6})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.radius * 0.4, 0, Math.PI * 2); ctx.fill(); });

    allUnits.forEach(u => u.draw(ctx));

    damageTexts.forEach(t => { ctx.fillStyle = t.color; ctx.font = `bold ${14 / camera.zoom}px sans-serif`; ctx.textAlign = 'center'; ctx.globalAlpha = t.life; ctx.fillText(t.text, t.x, t.y); ctx.globalAlpha = 1.0; });

    if (mouse.x && mouse.y && !isTouch) { const wp = screenToWorld(mouse.x, mouse.y); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1 / camera.zoom; ctx.beginPath(); ctx.arc(wp.x, wp.y, 8 / camera.zoom, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    drawMinimap();
}

function drawMinimap() {
    const mw = minimapCanvas.width, mh = minimapCanvas.height;
    mctx.fillStyle = '#1a2418'; mctx.fillRect(0, 0, mw, mh);
    mctx.strokeStyle = 'rgba(255,255,255,0.1)'; mctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) { mctx.beginPath(); mctx.moveTo(mw * i / 4, 0); mctx.lineTo(mw * i / 4, mh); mctx.stroke(); mctx.beginPath(); mctx.moveTo(0, mh * i / 4); mctx.lineTo(mw, mh * i / 4); mctx.stroke(); }
    const sx = mw / WORLD.width, sy = mh / WORLD.height;
    obstacles.forEach(obs => { mctx.fillStyle = obs.type === 'house' ? '#555' : obs.type === 'tree' ? '#2a4a2a' : obs.type === 'car' ? '#446' : '#7a6545'; mctx.fillRect((obs.x - obs.w/2) * sx, (obs.y - obs.h/2) * sy, obs.w * sx, obs.h * sy); });
    mctx.beginPath(); mctx.arc(objective.x * sx, objective.y * sy, 8, 0, Math.PI * 2); mctx.fillStyle = objective.owner === 'RU' ? 'rgba(213,43,30,0.5)' : objective.owner === 'US' ? 'rgba(60,110,182,0.5)' : 'rgba(255,215,0,0.3)'; mctx.fill(); mctx.strokeStyle = objective.owner === 'RU' ? '#d52b1e' : objective.owner === 'US' ? '#3c6eb6' : '#ffd700'; mctx.lineWidth = 1.5; mctx.stroke();
    allUnits.forEach(u => { if (u.dead) return; mctx.fillStyle = u.team === 'RU' ? '#d52b1e' : '#3c6eb6'; mctx.beginPath(); mctx.arc(u.x * sx, u.y * sy, 2, 0, Math.PI * 2); mctx.fill(); });
    const halfW = (W / 2) / camera.zoom, halfH = (H / 2) / camera.zoom; mctx.strokeStyle = 'rgba(255,255,255,0.8)'; mctx.lineWidth = 1; mctx.strokeRect((camera.x - halfW) * sx, (camera.y - halfH) * sy, halfW * 2 * sx, halfH * 2 * sy);
}

// ==================== ВВОД И UI ====================
let mouse = { x: 0, y: 0 }; const keys = {};
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const pointers = new Map(); let gestureState = { mode: null, lastCenter: null, lastDist: 0, startX: 0, startY: 0, moved: false, startTime: 0 };
let camBtnState = {}; let lastTap = { x: 0, y: 0, time: 0 }; let radialMenuVisible = false; let radialTarget = { x: 0, y: 0 };
let orderHintEl = null; let orderHintTimer = null;

canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', (e) => { if (gameOver) return; const wp = screenToWorld(e.clientX, e.clientY); if (e.button === 0) handleLeftClick(wp.x, wp.y); else if (e.button === 2) handleRightClick(wp.x, wp.y); });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });

canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || e.target !== canvas) return;
    canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) { gestureState.mode = null; gestureState.startX = e.clientX; gestureState.startY = e.clientY; gestureState.startTime = performance.now(); gestureState.moved = false; gestureState.lastCenter = { x: e.clientX, y: e.clientY }; }
    else if (pointers.size === 2) { gestureState.mode = 'pinch'; const pts = [...pointers.values()]; gestureState.lastDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y); gestureState.lastCenter = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }; }
}, { passive: false });

canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch' || !pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1 && gestureState.mode !== 'pinch') {
        const dx = e.clientX - gestureState.lastCenter.x, dy = e.clientY - gestureState.lastCenter.y;
        if (!gestureState.moved) { const tdx = e.clientX - gestureState.startX, tdy = e.clientY - gestureState.startY; if (Math.hypot(tdx, tdy) > 8) { gestureState.moved = true; gestureState.mode = 'pan'; hideRadialMenu(); } }
        if (gestureState.mode === 'pan') { camera.x -= dx / camera.zoom; camera.y -= dy / camera.zoom; clampCamera(); }
        gestureState.lastCenter = { x: e.clientX, y: e.clientY };
    } else if (pointers.size === 2) {
        const pts = [...pointers.values()]; const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const center = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        if (gestureState.lastDist > 0) { const factor = dist / gestureState.lastDist; if (Math.abs(factor - 1) > 0.005) zoomAt(center.x, center.y, factor); }
        if (gestureState.lastCenter) { camera.x -= (center.x - gestureState.lastCenter.x) / camera.zoom; camera.y -= (center.y - gestureState.lastCenter.y) / camera.zoom; clampCamera(); }
        gestureState.lastDist = dist; gestureState.lastCenter = center; gestureState.moved = true;
    }
}, { passive: false });

canvas.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch') return;
    pointers.delete(e.pointerId);
    if (pointers.size === 0) { if (!gestureState.moved && gestureState.mode !== 'pinch') { const dt = performance.now() - gestureState.startTime; if (dt < 350) handleTap(e.clientX, e.clientY); } gestureState.mode = null; gestureState.lastDist = 0; gestureState.lastCenter = null; }
    else if (pointers.size === 1) { const [p] = [...pointers.values()]; gestureState.lastCenter = { x: p.x, y: p.y }; gestureState.lastDist = 0; gestureState.mode = 'pan'; }
}, { passive: false });

canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); if (pointers.size === 0) { gestureState.mode = null; gestureState.lastDist = 0; } });

function handleTap(sx, sy) {
    if (gameOver) return;
    const now = performance.now(); const dt = now - lastTap.time, dist = Math.hypot(sx - lastTap.x, sy - lastTap.y);
    if (dt < 350 && dist < 40) { openRadialMenu(sx, sy); lastTap = { x: 0, y: 0, time: 0 }; return; }
    lastTap = { x: sx, y: sy, time: now };
    const wp = screenToWorld(sx, sy);
    for (const u of allUnits) {
        if (u.dead || u.team !== 'RU') continue;
        const tapRadius = Math.max(u.radius + 4 / camera.zoom, 14 / camera.zoom);
        if (Math.hypot(u.x - wp.x, u.y - wp.y) < tapRadius) { selectedUnits = [u]; updateSelectedUI(); return; }
    }
    for (const u of allUnits) {
        if (u.dead || u.team !== 'US') continue;
        const tapRadius = Math.max(u.radius + 6 / camera.zoom, 16 / camera.zoom);
        if (Math.hypot(u.x - wp.x, u.y - wp.y) < tapRadius) { selectedUnits.forEach(s => { s.moveTarget = { x: u.x, y: u.y }; s.holding = false; }); showStatus(`Атака: ${u.roleName}`); showOrderHint(wp.x, wp.y, 'attack'); return; }
    }
    executeOrderAt(wp.x, wp.y);
}

function executeOrderAt(wx, wy) {
    if (globalAIMode) { showStatus('Сначала перехватите управление (ИИ: ВЫКЛ)'); return; }
    const controllable = selectedUnits.filter(u => u.manualControl && !u.dead);
    if (controllable.length === 0) { showStatus('Нет солдат под управлением'); return; }
    const commander = ruUnits.find(u => u.role === 'commander' && !u.dead && u.manualControl);
    if (orderMode === 'move') {
        if (commander) { commander.moveTarget = { x: wx, y: wy }; commander.followTarget = null; commander.holding = false; commander.aimTimer = 0; commander.facing = Math.atan2(wy - commander.y, wx - commander.x); Formation.apply(commander); }
        else controllable.forEach(u => { u.moveTarget = { x: wx, y: wy }; u.followTarget = null; u.holding = false; u.aimTimer = 0; });
        showStatus('Движение'); showOrderHint(wx, wy, 'move');
    } else if (orderMode === 'attack') {
        controllable.forEach(u => { u.moveTarget = { x: wx, y: wy }; u.holding = false; u.aimTimer = 0; });
        showStatus('Атака'); showOrderHint(wx, wy, 'attack');
    } else if (orderMode === 'hold') {
        controllable.forEach(u => { u.moveTarget = { x: u.x, y: u.y }; u.followTarget = null; u.holding = true; u.formationPos = null; u.aimTimer = 0; });
        showStatus('Держать позицию');
    } else if (orderMode === 'follow') {
        ruUnits.forEach(u => { if (u !== commander && !u.dead && u.manualControl) { u.followTarget = commander; u.moveTarget = null; u.formationPos = null; u.holding = false; } });
        showStatus('Следовать за командиром');
    }
}

function showOrderHint(wx, wy, type) {
    if (!orderHintEl) return;
    const sp = worldToScreen(wx, wy); orderHintEl.style.left = sp.x + 'px'; orderHintEl.style.top = sp.y + 'px';
    orderHintEl.textContent = type === 'attack' ? '⚔ Атака' : '➜ Движение'; orderHintEl.style.color = type === 'attack' ? '#ff6b6b' : '#ffd700';
    orderHintEl.classList.add('visible'); clearTimeout(orderHintTimer); orderHintTimer = setTimeout(() => { orderHintEl.classList.remove('visible'); }, 800);
}

function openRadialMenu(sx, sy) { const menu = document.getElementById('radial-menu'); if (!menu || gameOver) return; radialTarget = { x: sx, y: sy }; menu.style.left = sx + 'px'; menu.style.top = sy + 'px'; menu.classList.add('visible'); radialMenuVisible = true; if (navigator.vibrate) navigator.vibrate(15); }
function hideRadialMenu() { const menu = document.getElementById('radial-menu'); if (menu) menu.classList.remove('visible'); radialMenuVisible = false; }
document.querySelectorAll('.radial-btn').forEach(btn => { btn.addEventListener('click', (e) => { e.stopPropagation(); hideRadialMenu(); const wp = screenToWorld(radialTarget.x, radialTarget.y); setOrderMode(btn.dataset.order); executeOrderAt(wp.x, wp.y); }); btn.addEventListener('pointerdown', (e) => e.stopPropagation()); });

document.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'Escape') { if (radialMenuVisible) hideRadialMenu(); else if (!gameOver) { selectedUnits = [ruUnits[0]]; updateSelectedUI(); } }
    if (e.key === '1') setStanceForSelected('stand');
    if (e.key === '2') setStanceForSelected('crouch');
    if (e.key === '3') setStanceForSelected('prone');
    if (e.key.toLowerCase() === 'z') autoStanceToggle();
    if (e.key.toLowerCase() === 'r') { selectedUnits.forEach(u => { if (u.dead || u.isReloading) return; if (u.ammo < u.weapon.maxAmmo) { u.isReloading = true; u.reloadTimer = u.weapon.reloadTime || 2.0; u.aimTimer = 0; } }); showStatus('Перезарядка'); }
});
document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

function setOrderMode(mode) {
    orderMode = mode;
    document.querySelectorAll('#orders button').forEach(b => b.classList.remove('active'));
    const aiBtn = document.getElementById('btn-ai-mode');
    if (aiBtn) aiBtn.style.background = globalAIMode ? '#4a3a6a' : '#6a3a3a';
    updateFormationButton();
    const map = { move: 'btn-move', attack: 'btn-attack', hold: 'btn-hold', follow: 'btn-follow' };
    const btn = document.getElementById(map[mode]); if (btn) btn.classList.add('active');
}
function setFormation(type) { Formation.current = type; updateFormationButton(); const commander = ruUnits.find(u => u.role === 'commander' && !u.dead); if (commander) { Formation.apply(commander); showStatus(type === 'march' ? 'Походный порядок' : 'Боевой порядок'); } }
function updateFormationButton() { const btn = document.getElementById('btn-formation'); if (!btn) return; btn.textContent = Formation.current === 'march' ? 'Колонна' : 'Цепь'; btn.classList.toggle('active', Formation.current === 'battle'); }
function setStanceForSelected(stance) { if (!['stand', 'crouch', 'prone'].includes(stance)) return; selectedUnits.forEach(u => { if (u.dead) return; u.stanceLocked = true; u.setStance(stance); }); document.querySelectorAll('.stance-btn').forEach(b => b.classList.remove('active')); const btnMap = { stand: 'btn-stand', crouch: 'btn-crouch', prone: 'btn-prone' }; const activeBtn = document.getElementById(btnMap[stance]); if (activeBtn) activeBtn.classList.add('active'); showStatus(`${CONFIG.stanceModifiers[stance].name}`); }
function autoStanceToggle() { CONFIG.autoStance = !CONFIG.autoStance; if (CONFIG.autoStance) { selectedUnits.forEach(u => u.stanceLocked = false); showStatus('Автосмена включена'); } else showStatus('Автосмена выключена'); }

// === ИСПРАВЛЕНО: фильтр мёртвых ===
function toggleAIMode() {
    const btn = document.getElementById('btn-ai-mode');
    if (globalAIMode) {
        const aliveSelected = selectedUnits.filter(u => !u.dead);
        if (aliveSelected.length === 0) { showStatus('Выберите живого солдата'); return; }
        selectedUnits = aliveSelected;
        const isCmd = selectedUnits.some(u => u.role === 'commander');
        if (isCmd) { ruUnits.forEach(u => { if (!u.dead) u.manualControl = true; }); showStatus('Ручное управление отделением'); }
        else { selectedUnits.forEach(u => u.manualControl = true); showStatus(`Ручное: ${selectedUnits[0].roleName}`); }
        globalAIMode = false; btn.textContent = 'ИИ: ВЫКЛ'; btn.style.background = '#6a3a3a';
    } else {
        ruUnits.forEach(u => { u.manualControl = false; u.moveTarget = null; u.followTarget = null; u.holding = false; u.formationPos = null; });
        globalAIMode = true; btn.textContent = 'ИИ: ВКЛ'; btn.style.background = '#4a3a6a'; showStatus('Управление ИИ');
    }
}
function showStatus(msg) { const el = document.getElementById('status-message'); if (!el) return; el.textContent = msg; clearTimeout(showStatus._t); showStatus._t = setTimeout(() => { el.textContent = ''; }, 2500); }

function updateSelectedUI() {
    const infoPanel = document.getElementById('weapon-info');
    if (!selectedUnits.length) { if(infoPanel) infoPanel.classList.remove('visible'); return; }
    const u = selectedUnits[0], w = u.weapon;
    const el = document.getElementById('selected-unit');
    if (el) {
        const aimPct = Math.round((u.aimLevel || 0) * 100);
        const stanceName = CONFIG.stanceModifiers[u.stance].name;
        const moralePct = Math.round(u.morale);
        const moraleIcon = u.moraleState === 'surrendered' ? '🏳️' : u.moraleState === 'routing' ? '🏃' : u.moraleState === 'panicked' ? '😱' : u.moraleState === 'cautious' ? '⚠️' : '';
        el.innerHTML = `<b>${u.roleName}</b> | HP ${Math.ceil(u.hp)} | ${stanceName}` +
                       (aimPct > 5 ? ` | 🎯 ${aimPct}%` : '') +
                       (u.suppressionLevel > 40 ? ' | ПОДАВЛЕН' : '') +
                       (moralePct < 100 ? ` | ${moraleIcon} ${moralePct}%` : '') +
                       (u.manualControl ? ' | РУЧНОЙ' : '');
    }
    if (infoPanel) {
        document.getElementById('wi-name').textContent = w.name;
        document.getElementById('wi-caliber').textContent = w.caliber || '—';
        document.getElementById('wi-weight').textContent = (w.weight || 0) + ' кг';
        let ammoStr = `${u.ammo} / ${w.maxAmmo}`; if (w.hasGL) ammoStr += ` (ГП: ${u.glAmmo})`;
        document.getElementById('wi-ammo').textContent = ammoStr;
        document.getElementById('wi-range').textContent = `${w.effRange || 0} / ${w.maxRange || 0} м`;
        document.getElementById('wi-rpm').textContent = `${w.rpm || 0} в/м`;
        infoPanel.classList.add('visible');
    }
}

function handleLeftClick(wx, wy) {
    for (const u of allUnits) { if (u.dead || u.team !== 'RU') continue; if (Math.hypot(u.x - wx, u.y - wy) < u.radius + 4 / camera.zoom) { selectedUnits = [u]; updateSelectedUI(); return; } }
    for (const u of allUnits) { if (u.dead || u.team !== 'US') continue; if (Math.hypot(u.x - wx, u.y - wy) < u.radius + 5 / camera.zoom) { selectedUnits.forEach(s => { s.moveTarget = { x: u.x, y: u.y }; s.holding = false; }); showStatus(`Атака: ${u.roleName}`); return; } }
    if (!selectedUnits.length) selectedUnits = [ruUnits[0]];
}
function handleRightClick(wx, wy) { executeOrderAt(wx, wy); }

function setupMinimapInput() {
    let minimapDrag = false;
    const setCameraFromMinimap = (e) => { const rect = minimapCanvas.getBoundingClientRect(); camera.x = ((e.clientX - rect.left) / rect.width) * WORLD.width; camera.y = ((e.clientY - rect.top) / rect.height) * WORLD.height; clampCamera(); };
    minimapCanvas.addEventListener('mousedown', (e) => { minimapDrag = true; setCameraFromMinimap(e); });
    minimapCanvas.addEventListener('mousemove', (e) => { if (minimapDrag) setCameraFromMinimap(e); });
    window.addEventListener('mouseup', () => { minimapDrag = false; });
    minimapCanvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') { minimapDrag = true; minimapCanvas.setPointerCapture(e.pointerId); setCameraFromMinimap(e); } });
    minimapCanvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch' && minimapDrag) setCameraFromMinimap(e); });
    minimapCanvas.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') minimapDrag = false; });
    minimapCanvas.addEventListener('pointercancel', () => { minimapDrag = false; });
}
function setupCameraButton(id, key) {
    const btn = document.getElementById(id); if (!btn) return;
    const start = (e) => { e.preventDefault(); camBtnState[key] = true; }; const end = (e) => { e.preventDefault(); camBtnState[key] = false; };
    btn.addEventListener('pointerdown', start); btn.addEventListener('pointerup', end); btn.addEventListener('pointerleave', end); btn.addEventListener('pointercancel', end);
    if (key === 'zoomIn' || key === 'zoomOut') btn.addEventListener('pointerdown', () => { zoomAt(W / 2, H / 2, key === 'zoomIn' ? 1.25 : 1 / 1.25); });
}
function initInput() {
    orderHintEl = document.createElement('div'); orderHintEl.id = 'order-hint'; document.getElementById('ui').appendChild(orderHintEl);
    setupMinimapInput();
    setupCameraButton('cam-up', 'up'); setupCameraButton('cam-down', 'down'); setupCameraButton('cam-zoom-in', 'zoomIn'); setupCameraButton('cam-zoom-out', 'zoomOut');
    document.addEventListener('pointerdown', (e) => { const menu = document.getElementById('radial-menu'); if (radialMenuVisible && menu && !menu.contains(e.target) && e.target !== canvas) hideRadialMenu(); }, true);
    const fBtn = document.getElementById('btn-formation'); if (fBtn) fBtn.addEventListener('click', (e) => { e.preventDefault(); setFormation(Formation.current === 'march' ? 'battle' : 'march'); }); updateFormationButton();
    const aiBtn = document.getElementById('btn-ai-mode'); if (aiBtn) aiBtn.addEventListener('click', (e) => { e.preventDefault(); toggleAIMode(); });
    const stanceMap = { 'btn-stand': 'stand', 'btn-crouch': 'crouch', 'btn-prone': 'prone' };
    Object.entries(stanceMap).forEach(([id, stance]) => { const btn = document.getElementById(id); if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setStanceForSelected(stance); }); });
    const orderBtns = { 'btn-move': 'move', 'btn-attack': 'attack', 'btn-hold': 'hold', 'btn-follow': 'follow' };
    Object.entries(orderBtns).forEach(([id, mode]) => { const btn = document.getElementById(id); if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setOrderMode(mode); }); });
    const reloadBtn = document.getElementById('btn-reload'); if (reloadBtn) reloadBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); selectedUnits.forEach(u => { if (u.dead || u.isReloading) return; if (u.ammo < u.weapon.maxAmmo) { u.isReloading = true; u.reloadTimer = u.weapon.reloadTime || 2.0; u.aimTimer = 0; } }); showStatus('Перезарядка'); });
}

let lastTime = performance.now();
function loop(now) { const dt = Math.min(0.05, (now - lastTime) / 1000); lastTime = now; update(dt); draw(); requestAnimationFrame(loop); }

// ==================== СТАРТ ====================
function startGameWithMap(mapType) {
    document.getElementById('map-select').style.display = 'none';
    generateMap(mapType);
    init();
    initInput();
    setOrderMode('move');
    requestAnimationFrame(loop);
}

document.getElementById('map-open').onclick   = () => startGameWithMap('open');
document.getElementById('map-forest').onclick = () => startGameWithMap('forest');
document.getElementById('map-city').onclick   = () => startGameWithMap('city');
