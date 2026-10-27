// ==================== КОНФИГУРАЦИЯ ====================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap');
const mctx = minimapCanvas.getContext('2d');
minimapCanvas.width = 180;
minimapCanvas.height = 180;

let W = 0, H = 0;
function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    clampCamera();
}
window.addEventListener('resize', resize);

// ==================== МИР 1×1 КМ ====================
const WORLD = { width: 1000, height: 1000 };

const camera = {
    x: WORLD.width / 2,
    y: WORLD.height / 2,
    zoom: 0.8,
    minZoom: 0.3,
    maxZoom: 4.0,
    panSpeed: 800,
};

// ==================== ОРУЖИЕ (ТТХ) ====================
const WEAPONS = {
    // --- РФ ---
    ak74m: {
        name: 'АК-74М', type: 'Автомат',
        caliber: '5.45×39 мм', weight: 3.3,
        magSize: 30, maxAmmo: 180,
        effRange: 250, maxRange: 600,
        fireRate: 0.6, rpm: 650,
        damage: 28, spread: 0.4,
        icon: '🔫'
    },
    ak74m_gp: {
        name: 'АК-74М + ГП-25', type: 'Автомат + ГП',
        caliber: '5.45×39 / 40 мм', weight: 4.8,
        magSize: 30, maxAmmo: 180,
        glAmmo: 4,
        effRange: 250, maxRange: 600,
        fireRate: 0.6, rpm: 650,
        damage: 28, spread: 0.4, hasGL: true,
        icon: '🔫💥'
    },
    pkm: {
        name: 'ПКП "Печенег"', type: 'Пулемёт',
        caliber: '7.62×54 мм R', weight: 8.2,
        magSize: 100, maxAmmo: 400,
        effRange: 450, maxRange: 1500,
        fireRate: 0.12, rpm: 650,
        damage: 18, spread: 0.6,
        icon: '💥'
    },
    rpg7: {
        name: 'РПГ-7В', type: 'Гранатомёт',
        caliber: '85 мм', weight: 6.3,
        magSize: 1, maxAmmo: 4,
        effRange: 330, maxRange: 700,
        fireRate: 6.0, rpm: 6,
        damage: 150, spread: 0.15, isAntiTank: true,
        icon: '🚀'
    },
    aks74u: {
        name: 'АКС-74У', type: 'Карабин',
        caliber: '5.45×39 мм', weight: 2.7,
        magSize: 30, maxAmmo: 120,
        effRange: 150, maxRange: 400,
        fireRate: 0.55, rpm: 700,
        damage: 24, spread: 0.6,
        icon: '🔫'
    },

    // --- США ---
    m4a1: {
        name: 'M4A1', type: 'Карабин',
        caliber: '5.56×45 NATO', weight: 3.4,
        magSize: 30, maxAmmo: 210,
        effRange: 300, maxRange: 600,
        fireRate: 0.55, rpm: 700,
        damage: 26, spread: 0.35,
        icon: '🔫'
    },
    m4a1_gl: {
        name: 'M4A1 + M320', type: 'Карабин + ГП',
        caliber: '5.56×45 / 40 мм', weight: 4.9,
        magSize: 30, maxAmmo: 210,
        glAmmo: 4,
        effRange: 300, maxRange: 600,
        fireRate: 0.55, rpm: 700,
        damage: 26, spread: 0.35, hasGL: true,
        icon: '🔫💥'
    },
    m249: {
        name: 'M249 SAW', type: 'Пулемёт',
        caliber: '5.56×45 NATO', weight: 7.5,
        magSize: 200, maxAmmo: 600,
        effRange: 400, maxRange: 1000,
        fireRate: 0.1, rpm: 750,
        damage: 16, spread: 0.7,
        icon: '💥'
    },
    m110: {
        name: 'M110 SASS', type: 'Снайперская',
        caliber: '7.62×51 NATO', weight: 5.0,
        magSize: 10, maxAmmo: 60,
        effRange: 600, maxRange: 1200,
        fireRate: 1.8, rpm: 30,
        damage: 65, spread: 0.05,
        icon: '🎯'
    }
};

const CONFIG = {
    soldierRadius: 4,
    speed: 8,
    viewRange: 350,
    objectiveRadius: 60,

    // Построения
    formationInterval: 7,
    formationIntervalMin: 6,
    formationIntervalMax: 8,
    formationRows: 2,
    marchColumnGap: 8,

    // Положения
    stanceSwitchTime: 0.8,
    stanceModifiers: {
        stand: { name: 'Стоя', speedMult: 1.0, damageMult: 1.0, hitChance: 1.0, targetSizeMult: 1.0 },
        crouch: { name: 'С колена', speedMult: 0.6, damageMult: 1.0, hitChance: 0.85, targetSizeMult: 0.7 },
        prone: { name: 'Лёжа', speedMult: 0.35, damageMult: 1.05, hitChance: 0.6, targetSizeMult: 0.45 }
    },
    autoStance: true,
};

// ==================== ПОСТРОЕНИЯ ====================
const Formation = {
    current: 'march',
    intervals: new Map(),

    getInterval(soldier) {
        if (!this.intervals.has(soldier)) {
            const idx = allUnits.indexOf(soldier);
            const t = ((idx * 37) % 100) / 100;
            this.intervals.set(soldier, CONFIG.formationIntervalMin + t * (CONFIG.formationIntervalMax - CONFIG.formationIntervalMin));
        }
        return this.intervals.get(soldier);
    },

    computePositions(commander, direction) {
        const alive = ruUnits.filter(u => !u.dead);
        const followers = alive.filter(u => u !== commander);
        const positions = new Map();

        if (this.current === 'march') {
            const backAngle = direction + Math.PI;
            followers.forEach((u, i) => {
                const gap = this.getInterval(u);
                const distBack = (i + 1) * gap;
                const px = commander.x + Math.cos(backAngle) * distBack;
                const py = commander.y + Math.sin(backAngle) * distBack;
                positions.set(u, { x: px, y: py });
            });
        } else {
            const perpAngle = direction + Math.PI / 2;
            const total = followers.length;
            followers.forEach((u, i) => {
                const idx = i - (total - 1) / 2;
                const avgGap = CONFIG.formationInterval;
                const lateral = idx * avgGap;
                const backOffset = 3;
                const px = commander.x +
                          Math.cos(perpAngle) * lateral +
                          Math.cos(direction + Math.PI) * backOffset;
                const py = commander.y +
                          Math.sin(perpAngle) * lateral +
                          Math.sin(direction + Math.PI) * backOffset;
                positions.set(u, { x: px, y: py });
            });
        }
        return positions;
    },

    apply(commander) {
        if (!commander || commander.dead) return;
        let dir = commander.facing;
        if (commander.moveTarget) {
            dir = Math.atan2(commander.moveTarget.y - commander.y, commander.moveTarget.x - commander.x);
        }
        const positions = this.computePositions(commander, dir);
        for (const [unit, pos] of positions) {
            unit.moveTarget = { x: pos.x, y: pos.y };
            unit.followTarget = null;
            unit.holding = false;
            unit.formationPos = { x: pos.x, y: pos.y };
        }
    },

    updateLive(commander) {
        if (!commander || commander.dead) return;
        if (!commander.moveTarget && !commander._justMoved) return;
        const now = performance.now();
        if (!this._lastLive || now - this._lastLive > 200) {
            this._lastLive = now;
            if (commander.moveTarget || commander.target) {
                this.apply(commander);
            }
        }
    }
};

// ==================== КЛАСС SOLDIER ====================
class Soldier {
    constructor(x, y, team, role, roleName, weaponId) {
        this.x = x; this.y = y;
        this.team = team; this.role = role; this.roleName = roleName;
        this.radius = CONFIG.soldierRadius;
        this.hp = 100; this.maxHp = 100; this.dead = false;
        this.target = null; this.moveTarget = null; this.followTarget = null;
        this.formationPos = null;
        this.state = 'idle'; this.cooldown = 0; this.facing = 0;
        this.muzzleFlash = 0; this.holding = false;

        // Положение
        this.stance = 'stand';
        this.desiredStance = 'stand';
        this.stanceTimer = 0;
        this.stanceLocked = false;

        // Оружие
        this.weapon = WEAPONS[weaponId] || WEAPONS.ak74m;
        this.weaponId = weaponId;
        this.range = this.weapon.effRange;
        this.damage = this.weapon.damage;
        this.fireRate = this.weapon.fireRate;
        this.spread = this.weapon.spread;

        // Боекомплект
        this.ammo = this.weapon.maxAmmo;
        this.glAmmo = this.weapon.glAmmo || 0;
        this.shotsFired = 0;
        this.reloadTimer = 0;
        this.isReloading = false;
    }

    update(dt, allUnits) {
        if (this.dead) return;

        // Перезарядка
        if (this.isReloading) {
            this.reloadTimer -= dt;
            if (this.reloadTimer <= 0) {
                this.isReloading = false;
            }
            return;
        }

        this.cooldown = Math.max(0, this.cooldown - dt);
        if (this.muzzleFlash > 0) this.muzzleFlash -= dt;

        if (this.stance !== this.desiredStance) {
            this.stanceTimer -= dt;
            if (this.stanceTimer <= 0) this.stance = this.desiredStance;
        }

        this.target = this.findEnemy(allUnits);

        if (CONFIG.autoStance && !this.stanceLocked) {
            this.autoSelectStance();
        }

        if (this.target && this.distanceTo(this.target) <= this.range) {
            this.state = 'attacking';
            this.facing = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            if (this.cooldown <= 0) this.fire();
        } else if (this.holding && this.moveTarget) {
            this.state = 'holding';
        } else if (this.moveTarget) {
            this.state = 'moving';
            this.moveToward(this.moveTarget.x, this.moveTarget.y, dt);
            if (this.distanceTo(this.moveTarget) < 3) this.moveTarget = null;
        } else if (this.formationPos && !this.holding && !this.target) {
            const d = Math.hypot(this.formationPos.x - this.x, this.formationPos.y - this.y);
            if (d > 2) {
                this.state = 'moving';
                this.moveToward(this.formationPos.x, this.formationPos.y, dt);
            } else this.state = 'idle';
        } else if (this.followTarget && !this.followTarget.dead) {
            const d = this.distanceTo(this.followTarget);
            if (d > 15) {
                this.moveToward(this.followTarget.x, this.followTarget.y, dt);
                this.state = 'moving';
            } else this.state = 'idle';
        } else if (this.target) {
            this.state = 'moving';
            this.moveToward(this.target.x, this.target.y, dt);
        } else this.state = 'idle';
    }

    autoSelectStance() {
        if (this.dead) return;
        const isMoving = this.state === 'moving';
        const inCombat = this.target && this.distanceTo(this.target) <= this.range * 1.5;

        if (isMoving) {
            this.setStance('stand');
        } else if (inCombat) {
            if (this.role === 'mg' || this.role === 'at') this.setStance('prone');
            else this.setStance('crouch');
        } else if (this.holding) {
            this.setStance('crouch');
        } else {
            this.setStance('stand');
        }
    }

    setStance(stance) {
        if (this.stance === stance || this.desiredStance === stance) return;
        this.desiredStance = stance;
        this.stanceTimer = CONFIG.stanceSwitchTime;
    }

    fire() {
        if (this.isReloading) return;

        const isGL = this.weapon.hasGL && Math.random() < 0.3;
        if (isGL && this.glAmmo <= 0) return;
        if (!isGL && this.ammo <= 0) {
            this.isReloading = true;
            this.reloadTimer = 3.0;
            return;
        }

        if (isGL) this.glAmmo--;
        else this.ammo--;

        this.cooldown = this.fireRate;
        this.muzzleFlash = 0.06;
        this.shotsFired++;

        const t = this.target;
        if (!t || t.dead) return;

        const myMod = CONFIG.stanceModifiers[this.stance];
        const targetMod = CONFIG.stanceModifiers[t.stance];
        const dist = this.distanceTo(t);
        
        // Штраф за превышение эффективной дальности
        let distFactor = 1.0;
        if (dist > this.weapon.effRange) {
            distFactor = Math.max(0.1, 1 - (dist - this.weapon.effRange) / (this.weapon.maxRange - this.weapon.effRange));
        } else {
            distFactor = 1 - Math.min(0.3, (dist / this.weapon.effRange) * 0.3);
        }

        const weaponAccuracy = 1 - this.spread;
        const hitChance = weaponAccuracy * myMod.hitChance * targetMod.hitChance * distFactor * (0.85 + Math.random() * 0.3);

        const isExplosive = this.weapon.isAntiTank || isGL;

        if (isExplosive) {
            const blastRadius = this.weapon.isAntiTank ? 15 : 8;
            allUnits.forEach(u => {
                if (u.dead || u.team === this.team) return;
                const d = Math.hypot(u.x - t.x, u.y - t.y);
                if (d < blastRadius) {
                    const falloff = 1 - (d / blastRadius);
                    const dmg = (isGL ? 80 : this.damage) * myMod.damageMult * falloff;
                    u.hp -= dmg;
                    if (u.hp <= 0) { u.hp = 0; u.dead = true; }
                }
            });
            explosions.push({ x: t.x, y: t.y, radius: blastRadius, life: 0.5 });
        } else {
            if (Math.random() < hitChance) {
                t.hp -= this.damage * myMod.damageMult * (0.85 + Math.random() * 0.3);
                if (t.hp <= 0) { t.hp = 0; t.dead = true; }
            }
        }

        bullets.push({ 
            x: this.x, y: this.y, 
            tx: t.x + (Math.random() - 0.5) * 40, 
            ty: t.y + (Math.random() - 0.5) * 40,
            color: isExplosive ? '#ff6b1a' : (this.team === 'RU' ? '#ffdd55' : '#66ddff'), 
            life: isExplosive ? 0.3 : 0.15 
        });
    }

    findEnemy(allUnits) {
        let best = null, bestDist = Infinity;
        for (const u of allUnits) {
            if (u.dead || u.team === this.team) continue;
            const d = this.distanceTo(u);
            if (d < CONFIG.viewRange && d < bestDist) { bestDist = d; best = u; }
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
        this.x += (dx / dist) * step;
        this.y += (dy / dist) * step;
        this.facing = Math.atan2(dy, dx);
        this.x = Math.max(2, Math.min(WORLD.width - 2, this.x));
        this.y = Math.max(2, Math.min(WORLD.height - 2, this.y));
    }

    distanceTo(o) { return Math.hypot(o.x - this.x, o.y - this.y); }

    draw(ctx) {
        if (this.dead) {
            ctx.fillStyle = 'rgba(80,80,80,0.4)';
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
            return;
        }
        const baseColor = this.team === 'RU' ? '#d52b1e' : '#3c6eb6';
        const isCommander = this.role === 'commander' || this.role === 'squad_leader';
        const isSelected = selectedUnits.includes(this);
        const mod = CONFIG.stanceModifiers[this.stance];
        const visualRadius = this.radius * Math.sqrt(mod.targetSizeMult);

        if (isSelected) {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 1.5 / camera.zoom;
            ctx.beginPath(); ctx.arc(this.x, this.y, visualRadius + 4, 0, Math.PI * 2); ctx.stroke();
        }

        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(this.x + 1.5, this.y + 1.5, visualRadius, visualRadius * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = baseColor;
        if (this.stance === 'prone') {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.facing);
            ctx.beginPath();
            ctx.ellipse(0, 0, visualRadius * 1.6, visualRadius * 0.8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else if (this.stance === 'crouch') {
            ctx.beginPath(); ctx.arc(this.x, this.y, visualRadius * 0.9, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.beginPath(); ctx.arc(this.x, this.y, visualRadius, 0, Math.PI * 2); ctx.fill();
        }

        if (isCommander) {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 1.2 / camera.zoom;
            ctx.beginPath(); ctx.arc(this.x, this.y, visualRadius, 0, Math.PI * 2); ctx.stroke();
        } else if (this.stance !== 'prone') {
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 0.6 / camera.zoom;
            ctx.stroke();
        }

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = (this.stance === 'prone' ? 1.5 : 1.2) / camera.zoom;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(this.facing) * (visualRadius + 3), this.y + Math.sin(this.facing) * (visualRadius + 3));
        ctx.stroke();

        if (this.muzzleFlash > 0) {
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.arc(this.x + Math.cos(this.facing) * (visualRadius + 2), this.y + Math.sin(this.facing) * (visualRadius + 2), 
                    this.stance === 'prone' ? 3.5 : 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        const hpFrac = this.hp / this.maxHp;
        const barW = 12 / camera.zoom, barH = 2 / camera.zoom;
        if (hpFrac < 1) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(this.x - barW / 2, this.y - visualRadius - 6 / camera.zoom, barW, barH);
            ctx.fillStyle = hpFrac > 0.5 ? '#3c3' : hpFrac > 0.25 ? '#fc3' : '#f33';
            ctx.fillRect(this.x - barW / 2, this.y - visualRadius - 6 / camera.zoom, barW * hpFrac, barH);
        }

        if (this.isReloading) {
            const progress = 1 - (this.reloadTimer / 3.0);
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2 / camera.zoom;
            ctx.beginPath();
            ctx.arc(this.x, this.y, visualRadius + 6, -Math.PI/2, -Math.PI/2 + Math.PI * 2 * progress);
            ctx.stroke();
        }

        if (this.ammo < this.weapon.maxAmmo * 0.2 && !this.isReloading) {
            ctx.fillStyle = '#ff6b6b';
            ctx.beginPath();
            ctx.arc(this.x + visualRadius + 4, this.y - visualRadius - 4, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        if (camera.zoom > 1.2 && this.stance !== 'prone') {
            ctx.fillStyle = '#fff';
            ctx.font = `${10 / camera.zoom}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(this.weapon.icon, this.x, this.y - visualRadius - 4 / camera.zoom);
            
            const labels = { commander: 'К', squad_leader: 'К', mg: 'П', senior: 'СС', rifleman: 'С', at: 'Г', at_assist: 'ПГ' };
            if (labels[this.role]) {
                ctx.font = `bold ${7 / camera.zoom}px sans-serif`;
                ctx.fillText(labels[this.role], this.x, this.y - visualRadius - 14 / camera.zoom);
            }
        }
    }
}

// ==================== СОСТОЯНИЕ ====================
let ruUnits = [], usUnits = [], allUnits = [], selectedUnits = [], bullets = [], explosions = [];
let objective = { x: 0, y: 0, radius: CONFIG.objectiveRadius, owner: 'neutral', holdTime: 0 };
let gameTime = 0, gameOver = false, orderMode = 'move';

function createRussianSquad(cx, cy) {
    return [
        new Soldier(cx, cy, 'RU', 'commander', 'Ком. отделения', 'ak74m'),
        new Soldier(cx - 15, cy + 12, 'RU', 'at', 'Гранатометчик', 'rpg7'),
        new Soldier(cx - 8, cy + 24, 'RU', 'at_assist', 'Пом. гранатометчика', 'ak74m'),
        new Soldier(cx + 15, cy + 12, 'RU', 'mg', 'Пулеметчик', 'pkm'),
        new Soldier(cx + 8, cy + 24, 'RU', 'senior', 'Старший стрелок', 'ak74m_gp'),
        new Soldier(cx + 22, cy + 24, 'RU', 'rifleman', 'Стрелок', 'ak74m_gp'),
    ];
}

function createUSSquad(cx, cy) {
    return [
        new Soldier(cx, cy, 'US', 'squad_leader', 'Ком. отделения', 'm4a1'),
        new Soldier(cx + 15, cy + 8, 'US', 'commander', 'Ком. группы А', 'm4a1'),
        new Soldier(cx + 22, cy + 16, 'US', 'mg', 'Пулеметчик А', 'm249'),
        new Soldier(cx + 8, cy + 16, 'US', 'at', 'Гренадер А', 'm4a1_gl'),
        new Soldier(cx + 30, cy + 24, 'US', 'rifleman', 'Стрелок А (M110)', 'm110'),
        new Soldier(cx - 15, cy + 8, 'US', 'commander', 'Ком. группы Б', 'm4a1'),
        new Soldier(cx - 22, cy + 16, 'US', 'mg', 'Пулеметчик Б', 'm249'),
        new Soldier(cx - 8, cy + 16, 'US', 'at', 'Гренадер Б', 'm4a1_gl'),
        new Soldier(cx - 30, cy + 24, 'US', 'rifleman', 'Стрелок Б', 'm4a1'),
    ];
}

function init() {
    resize();

    ruUnits = createRussianSquad(150, 850);
    usUnits = createUSSquad(850, 150);
    allUnits = [...ruUnits, ...usUnits];

    objective = {
        x: WORLD.width / 2, y: WORLD.height / 2,
        radius: CONFIG.objectiveRadius, owner: 'neutral', holdTime: 0
    };

    selectedUnits = [ruUnits[0]];
    for (let i = 1; i < ruUnits.length; i++) ruUnits[i].followTarget = ruUnits[0];

    const fitZoom = Math.min(W / WORLD.width, H / WORLD.height) * 0.95;
    camera.zoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, fitZoom));
    camera.x = WORLD.width / 2;
    camera.y = WORLD.height / 2;
    clampCamera();

    updateUI();
}

// ==================== КАМЕРА ====================
function screenToWorld(sx, sy) {
    return { x: (sx - W / 2) / camera.zoom + camera.x, y: (sy - H / 2) / camera.zoom + camera.y };
}
function worldToScreen(wx, wy) {
    return { x: (wx - camera.x) * camera.zoom + W / 2, y: (wy - camera.y) * camera.zoom + H / 2 };
}
function clampCamera() {
    if (!W || !H) return;
    const halfW = (W / 2) / camera.zoom;
    const halfH = (H / 2) / camera.zoom;
    if (WORLD.width * camera.zoom < W) camera.x = WORLD.width / 2;
    else camera.x = Math.max(halfW, Math.min(WORLD.width - halfW, camera.x));
    if (WORLD.height * camera.zoom < H) camera.y = WORLD.height / 2;
    else camera.y = Math.max(halfH, Math.min(WORLD.height - halfH, camera.y));
}
function zoomAt(sx, sy, factor) {
    const before = screenToWorld(sx, sy);
    camera.zoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, camera.zoom * factor));
    const after = screenToWorld(sx, sy);
    camera.x += before.x - after.x;
    camera.y += before.y - after.y;
    clampCamera();
}

// ==================== ВВОД ====================
let mouse = { x: 0, y: 0 };
const keys = {};
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

const pointers = new Map();
let gestureState = {
    mode: null, lastCenter: null, lastDist: 0,
    startX: 0, startY: 0, moved: false, startTime: 0,
};
let camBtnState = {};
let lastTap = { x: 0, y: 0, time: 0 };
let radialMenuVisible = false;
let radialTarget = { x: 0, y: 0 };
let orderHintEl = null;
let orderHintTimer = null;

canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });

canvas.addEventListener('mousedown', (e) => {
    if (gameOver) return;
    const wp = screenToWorld(e.clientX, e.clientY);
    if (e.button === 0) handleLeftClick(wp.x, wp.y);
    else if (e.button === 2) handleRightClick(wp.x, wp.y);
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
}, { passive: false });

canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1) {
        gestureState.mode = null;
        gestureState.startX = e.clientX;
        gestureState.startY = e.clientY;
        gestureState.startTime = performance.now();
        gestureState.moved = false;
        gestureState.lastCenter = { x: e.clientX, y: e.clientY };
    } else if (pointers.size === 2) {
        gestureState.mode = 'pinch';
        const pts = [...pointers.values()];
        gestureState.lastDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        gestureState.lastCenter = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    }
}, { passive: false });

canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch') return;
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1 && gestureState.mode !== 'pinch') {
        const dx = e.clientX - gestureState.lastCenter.x;
        const dy = e.clientY - gestureState.lastCenter.y;

        if (!gestureState.moved) {
            const totalDx = e.clientX - gestureState.startX;
            const totalDy = e.clientY - gestureState.startY;
            if (Math.hypot(totalDx, totalDy) > 8) {
                gestureState.moved = true;
                gestureState.mode = 'pan';
                hideRadialMenu();
            }
        }

        if (gestureState.mode === 'pan') {
            camera.x -= dx / camera.zoom;
            camera.y -= dy / camera.zoom;
            clampCamera();
        }
        gestureState.lastCenter = { x: e.clientX, y: e.clientY };
    } else if (pointers.size === 2) {
        const pts = [...pointers.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const center = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };

        if (gestureState.lastDist > 0) {
            const factor = dist / gestureState.lastDist;
            if (Math.abs(factor - 1) > 0.005) zoomAt(center.x, center.y, factor);
        }
        if (gestureState.lastCenter) {
            camera.x -= (center.x - gestureState.lastCenter.x) / camera.zoom;
            camera.y -= (center.y - gestureState.lastCenter.y) / camera.zoom;
            clampCamera();
        }
        gestureState.lastDist = dist;
        gestureState.lastCenter = center;
        gestureState.moved = true;
    }
}, { passive: false });

canvas.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch') return;
    pointers.delete(e.pointerId);

    if (pointers.size === 0) {
        if (!gestureState.moved && gestureState.mode !== 'pinch') {
            const dt = performance.now() - gestureState.startTime;
            if (dt < 350) handleTap(e.clientX, e.clientY);
        }
        gestureState.mode = null;
        gestureState.lastDist = 0;
        gestureState.lastCenter = null;
    } else if (pointers.size === 1) {
        const [p] = [...pointers.values()];
        gestureState.lastCenter = { x: p.x, y: p.y };
        gestureState.lastDist = 0;
        gestureState.mode = 'pan';
    }
}, { passive: false });

canvas.addEventListener('pointercancel', (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
        gestureState.mode = null;
        gestureState.lastDist = 0;
    }
});

function handleTap(sx, sy) {
    if (gameOver) return;

    const now = performance.now();
    const dt = now - lastTap.time;
    const dist = Math.hypot(sx - lastTap.x, sy - lastTap.y);

    if (dt < 350 && dist < 40) {
        openRadialMenu(sx, sy);
        lastTap = { x: 0, y: 0, time: 0 };
        return;
    }
    lastTap = { x: sx, y: sy, time: now };

    const wp = screenToWorld(sx, sy);

    for (const u of allUnits) {
        if (u.dead || u.team !== 'RU') continue;
        const tapRadius = Math.max(u.radius + 4 / camera.zoom, 14 / camera.zoom);
        if (Math.hypot(u.x - wp.x, u.y - wp.y) < tapRadius) {
            selectedUnits = [u];
            updateSelectedUI();
            return;
        }
    }

    for (const u of allUnits) {
        if (u.dead || u.team !== 'US') continue;
        const tapRadius = Math.max(u.radius + 6 / camera.zoom, 16 / camera.zoom);
        if (Math.hypot(u.x - wp.x, u.y - wp.y) < tapRadius) {
            selectedUnits.forEach(s => {
                s.moveTarget = { x: u.x, y: u.y };
                s.holding = false;
            });
            showStatus(`Атака: ${u.roleName}`);
            showOrderHint(wp.x, wp.y, 'attack');
            return;
        }
    }

    executeOrderAt(wp.x, wp.y);
}

function executeOrderAt(wx, wy) {
    const commander = ruUnits.find(u => u.role === 'commander' && !u.dead);

    if (orderMode === 'move') {
        if (commander) {
            commander.moveTarget = { x: wx, y: wy };
            commander.followTarget = null;
            commander.holding = false;
            commander.facing = Math.atan2(wy - commander.y, wx - commander.x);
            Formation.apply(commander);
        } else {
            selectedUnits.forEach(u => {
                u.moveTarget = { x: wx, y: wy };
                u.followTarget = null;
                u.holding = false;
            });
        }
        showStatus(Formation.current === 'march' ? 'Походный порядок' : 'Боевой порядок');
        showOrderHint(wx, wy, 'move');
    } else if (orderMode === 'attack') {
        if (commander) {
            commander.moveTarget = { x: wx, y: wy };
            commander.facing = Math.atan2(wy - commander.y, wx - commander.x);
            const prev = Formation.current;
            Formation.current = 'battle';
            Formation.apply(commander);
            Formation.current = prev;
            updateFormationButton();
        }
        selectedUnits.forEach(u => {
            if (u !== commander) u.holding = false;
        });
        showStatus('Атака в точку');
        showOrderHint(wx, wy, 'attack');
    } else if (orderMode === 'hold') {
        selectedUnits.forEach(u => {
            u.moveTarget = { x: u.x, y: u.y };
            u.followTarget = null;
            u.holding = true;
            u.formationPos = null;
        });
        showStatus('Держать позицию');
    } else if (orderMode === 'follow') {
        ruUnits.forEach(u => {
            if (u !== commander && !u.dead) {
                u.followTarget = commander;
                u.moveTarget = null;
                u.formationPos = null;
                u.holding = false;
            }
        });
        showStatus('Следовать за командиром');
    }
}

function showOrderHint(wx, wy, type) {
    if (!orderHintEl) return;
    const sp = worldToScreen(wx, wy);
    orderHintEl.style.left = sp.x + 'px';
    orderHintEl.style.top = sp.y + 'px';
    orderHintEl.textContent = type === 'attack' ? '⚔ Атака' : '➜ Движение';
    orderHintEl.style.color = type === 'attack' ? '#ff6b6b' : '#ffd700';
    orderHintEl.classList.add('visible');
    clearTimeout(orderHintTimer);
    orderHintTimer = setTimeout(() => {
        orderHintEl.classList.remove('visible');
    }, 800);
}

function openRadialMenu(sx, sy) {
    const menu = document.getElementById('radial-menu');
    if (!menu || gameOver) return;
    radialTarget = { x: sx, y: sy };
    menu.style.left = sx + 'px';
    menu.style.top = sy + 'px';
    menu.classList.add('visible');
    radialMenuVisible = true;
    if (navigator.vibrate) navigator.vibrate(15);
}

function hideRadialMenu() {
    const menu = document.getElementById('radial-menu');
    if (menu) menu.classList.remove('visible');
    radialMenuVisible = false;
}

document.querySelectorAll('.radial-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const order = btn.dataset.order;
        hideRadialMenu();
        const wp = screenToWorld(radialTarget.x, radialTarget.y);
        setOrderMode(order);
        executeOrderAt(wp.x, wp.y);
    });
    btn.addEventListener('pointerdown', (e) => e.stopPropagation());
});

document.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'Escape') {
        if (radialMenuVisible) hideRadialMenu();
        else if (!gameOver) {
            selectedUnits = [ruUnits[0]];
            updateSelectedUI();
        }
    }
    if (e.key === '1') setStanceForSelected('stand');
    if (e.key === '2') setStanceForSelected('crouch');
    if (e.key === '3') setStanceForSelected('prone');
    if (e.key.toLowerCase() === 'z') autoStanceToggle();
    if (e.key.toLowerCase() === 'r') {
        selectedUnits.forEach(u => {
            if (u.dead || u.isReloading) return;
            if (u.ammo < u.weapon.maxAmmo) {
                u.isReloading = true;
                u.reloadTimer = 2.0;
            }
        });
        showStatus('Перезарядка');
    }
});
document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

document.getElementById('btn-move').onclick = () => setOrderMode('move');
document.getElementById('btn-attack').onclick = () => setOrderMode('attack');
document.getElementById('btn-hold').onclick = () => setOrderMode('hold');
document.getElementById('btn-follow').onclick = () => setOrderMode('follow');

document.getElementById('btn-reload').onclick = () => {
    selectedUnits.forEach(u => {
        if (u.dead || u.isReloading) return;
        if (u.ammo < u.weapon.maxAmmo) {
            u.isReloading = true;
            u.reloadTimer = 2.0;
            showStatus(`Перезарядка: ${u.roleName}`);
        }
    });
};

function setOrderMode(mode) {
    orderMode = mode;
    document.querySelectorAll('#orders button').forEach(b => b.classList.remove('active'));
    const map = { move: 'btn-move', attack: 'btn-attack', hold: 'btn-hold', follow: 'btn-follow' };
    const btn = document.getElementById(map[mode]);
    if (btn) btn.classList.add('active');
    showStatus('Режим: ' + ({ move: 'Движение', attack: 'Атака', hold: 'Держать', follow: 'Следовать' })[mode]);
}

function setFormation(type) {
    Formation.current = type;
    updateFormationButton();
    const commander = ruUnits.find(u => u.role === 'commander' && !u.dead);
    if (commander) {
        Formation.apply(commander);
        showStatus(type === 'march' ? 'Походный порядок (колонна)' : 'Боевой порядок (цепь)');
    }
}

function updateFormationButton() {
    const btn = document.getElementById('btn-formation');
    if (!btn) return;
    btn.textContent = Formation.current === 'march' ? 'Колонна' : 'Цепь';
    btn.classList.toggle('active', Formation.current === 'battle');
}

function setStanceForSelected(stance) {
    const validStances = ['stand', 'crouch', 'prone'];
    if (!validStances.includes(stance)) return;
    
    selectedUnits.forEach(u => {
        if (u.dead) return;
        u.stanceLocked = true;
        u.setStance(stance);
    });
    
    document.querySelectorAll('.stance-btn').forEach(b => b.classList.remove('active'));
    const btnMap = { stand: 'btn-stand', crouch: 'btn-crouch', prone: 'btn-prone' };
    const activeBtn = document.getElementById(btnMap[stance]);
    if (activeBtn) activeBtn.classList.add('active');
    
    showStatus(`${CONFIG.stanceModifiers[stance].name}`);
}

function autoStanceToggle() {
    CONFIG.autoStance = !CONFIG.autoStance;
    if (CONFIG.autoStance) {
        selectedUnits.forEach(u => u.stanceLocked = false);
        showStatus('Автосмена включена');
    } else {
        showStatus('Автосмена выключена');
    }
}

function showStatus(msg) {
    const el = document.getElementById('status-message');
    if (!el) return;
    el.textContent = msg;
    clearTimeout(showStatus._t);
    showStatus._t = setTimeout(() => { el.textContent = ''; }, 2000);
}

function updateSelectedUI() {
    const infoPanel = document.getElementById('weapon-info');
    if (!selectedUnits.length) {
        if(infoPanel) infoPanel.classList.remove('visible');
        return;
    }
    const u = selectedUnits[0];
    const w = u.weapon;

    const el = document.getElementById('selected-unit');
    if (el) el.innerHTML = `<b>${u.roleName}</b> | HP ${Math.ceil(u.hp)}`;

    if (infoPanel) {
        document.getElementById('wi-name').textContent = w.name;
        document.getElementById('wi-caliber').textContent = w.caliber;
        document.getElementById('wi-weight').textContent = `${w.weight} кг`;
        
        let ammoStr = `${u.ammo} / ${w.maxAmmo}`;
        if (w.hasGL) ammoStr += ` (ГП: ${u.glAmmo})`;
        document.getElementById('wi-ammo').textContent = ammoStr;
        
        document.getElementById('wi-range').textContent = `${w.effRange} / ${w.maxRange} м`;
        document.getElementById('wi-rpm').textContent = `${w.rpm} в/м`;
        infoPanel.classList.add('visible');
    }
}

function handleLeftClick(wx, wy) {
    for (const u of allUnits) {
        if (u.dead || u.team !== 'RU') continue;
        if (Math.hypot(u.x - wx, u.y - wy) < u.radius + 4 / camera.zoom) {
            selectedUnits = [u]; updateSelectedUI(); return;
        }
    }
    for (const u of allUnits) {
        if (u.dead || u.team !== 'US') continue;
        if (Math.hypot(u.x - wx, u.y - wy) < u.radius + 5 / camera.zoom) {
            selectedUnits.forEach(s => { s.moveTarget = { x: u.x, y: u.y }; s.holding = false; });
            showStatus(`Атака: ${u.roleName}`);
            return;
        }
    }
    if (!selectedUnits.length) selectedUnits = [ruUnits[0]];
}

function handleRightClick(wx, wy) {
    executeOrderAt(wx, wy);
}

function setupMinimapInput() {
    let minimapDrag = false;
    const setCameraFromMinimap = (e) => {
        const rect = minimapCanvas.getBoundingClientRect();
        camera.x = ((e.clientX - rect.left) / rect.width) * WORLD.width;
        camera.y = ((e.clientY - rect.top) / rect.height) * WORLD.height;
        clampCamera();
    };

    minimapCanvas.addEventListener('mousedown', (e) => { minimapDrag = true; setCameraFromMinimap(e); });
    minimapCanvas.addEventListener('mousemove', (e) => { if (minimapDrag) setCameraFromMinimap(e); });
    window.addEventListener('mouseup', () => { minimapDrag = false; });

    minimapCanvas.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') {
            minimapDrag = true;
            minimapCanvas.setPointerCapture(e.pointerId);
            setCameraFromMinimap(e);
        }
    });
    minimapCanvas.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch' && minimapDrag) setCameraFromMinimap(e);
    });
    minimapCanvas.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') minimapDrag = false; });
    minimapCanvas.addEventListener('pointercancel', () => { minimapDrag = false; });
}

function setupCameraButton(id, key) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const start = (e) => { e.preventDefault(); camBtnState[key] = true; };
    const end = (e) => { e.preventDefault(); camBtnState[key] = false; };
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointerleave', end);
    btn.addEventListener('pointercancel', end);
    if (key === 'zoomIn' || key === 'zoomOut') {
        btn.addEventListener('pointerdown', () => {
            zoomAt(W / 2, H / 2, key === 'zoomIn' ? 1.25 : 1 / 1.25);
        });
    }
}

function initInput() {
    orderHintEl = document.createElement('div');
    orderHintEl.id = 'order-hint';
    document.getElementById('ui').appendChild(orderHintEl);

    setupMinimapInput();
    setupCameraButton('cam-up', 'up');
    setupCameraButton('cam-down', 'down');
    setupCameraButton('cam-zoom-in', 'zoomIn');
    setupCameraButton('cam-zoom-out', 'zoomOut');

    document.addEventListener('pointerdown', (e) => {
        const menu = document.getElementById('radial-menu');
        if (radialMenuVisible && menu && !menu.contains(e.target) && e.target !== canvas) hideRadialMenu();
    }, true);

    const fBtn = document.getElementById('btn-formation');
    if (fBtn) fBtn.addEventListener('click', () => setFormation(Formation.current === 'march' ? 'battle' : 'march'));
    updateFormationButton();

    const stanceMap = { 'btn-stand': 'stand', 'btn-crouch': 'crouch', 'btn-prone': 'prone' };
    Object.entries(stanceMap).forEach(([id, stance]) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); setStanceForSelected(stance); });
    });
}

// ==================== ИИ США ====================
function updateUSAI(dt) {
    const usAlive = usUnits.filter(u => !u.dead);
    const commander = usAlive.find(u => u.role === 'squad_leader');
    if (commander && !commander.moveTarget && !commander.target) {
        commander.moveTarget = { x: objective.x, y: objective.y };
    }
    const groupLeaders = usAlive.filter(u => u.role === 'commander');
    groupLeaders.forEach(gl => { if (!gl.followTarget && commander) gl.followTarget = commander; });
    usAlive.forEach(u => {
        if (u.role === 'squad_leader' || u.role === 'commander') return;
        if (!u.followTarget) {
            const leader = groupLeaders.reduce((best, gl) => {
                const d = Math.hypot(gl.x - u.x, gl.y - u.y);
                return d < best.d ? { gl, d } : best;
            }, { gl: null, d: Infinity }).gl;
            if (leader) u.followTarget = leader;
        }
    });

    const sniper = usAlive.find(u => u.weaponId === 'm110');
    if (sniper && commander) {
        if (!sniper._hasSniperPos) {
            const backAngle = commander.facing + Math.PI;
            sniper.moveTarget = {
                x: commander.x + Math.cos(backAngle) * 40,
                y: commander.y + Math.sin(backAngle) * 40
            };
            sniper._hasSniperPos = true;
        }
    }
}

// ==================== ОБНОВЛЕНИЕ ====================
function update(dt) {
    if (gameOver) return;
    gameTime += dt;

    const pan = (camera.panSpeed / camera.zoom) * dt;
    if (keys['a'] || keys['arrowleft']) camera.x -= pan;
    if (keys['d'] || keys['arrowright']) camera.x += pan;
    if (keys['w'] || keys['arrowup']) camera.y -= pan;
    if (keys['s'] || keys['arrowdown']) camera.y += pan;
    if (camBtnState.up) camera.y -= pan;
    if (camBtnState.down) camera.y += pan;
    clampCamera();

    updateUSAI(dt);
    
    const cmd = ruUnits.find(u => u.role === 'commander' && !u.dead);
    if (cmd && (cmd.moveTarget || cmd.target)) {
        Formation.updateLive(cmd);
    }

    allUnits.forEach(u => u.update(dt, allUnits));

    bullets.forEach(b => b.life -= dt);
    bullets = bullets.filter(b => b.life > 0);
    
    explosions.forEach(e => e.life -= dt);
    explosions = explosions.filter(e => e.life > 0);

    checkObjective(dt);

    const ruAlive = ruUnits.filter(u => !u.dead).length;
    const usAlive = usUnits.filter(u => !u.dead).length;
    if (ruAlive === 0) endGame('US');
    else if (usAlive === 0) endGame('RU');

    updateUI();
}

function checkObjective(dt) {
    const ruNear = ruUnits.filter(u => !u.dead && Math.hypot(u.x - objective.x, u.y - objective.y) < objective.radius).length;
    const usNear = usUnits.filter(u => !u.dead && Math.hypot(u.x - objective.x, u.y - objective.y) < objective.radius).length;
    if (ruNear > 0 && usNear === 0) {
        if (objective.owner !== 'RU') {
            objective.holdTime += dt;
            if (objective.holdTime > 3) { objective.owner = 'RU'; objective.holdTime = 0; }
        }
    } else if (usNear > 0 && ruNear === 0) {
        if (objective.owner !== 'US') {
            objective.holdTime += dt;
            if (objective.holdTime > 3) { objective.owner = 'US'; objective.holdTime = 0; }
        }
    } else objective.holdTime = Math.max(0, objective.holdTime - dt);
}

function endGame(team) {
    gameOver = true;
    document.getElementById('game-over').classList.remove('hidden');
    document.getElementById('result-text').textContent = team === 'RU' ? '🏆 Победа России!' : '🏆 Победа США!';
}

function updateUI() {
    const ruAlive = ruUnits.filter(u => !u.dead).length;
    const usAlive = usUnits.filter(u => !u.dead).length;
    document.getElementById('ru-count').textContent = `Живых: ${ruAlive}/${ruUnits.length}`;
    document.getElementById('us-count').textContent = `Живых: ${usAlive}/${usUnits.length}`;
    const statusText = { neutral: 'нейтральна', RU: '🇷🇺 РФ', US: '🇺🇸 США' }[objective.owner];
    document.getElementById('objective-status').textContent = `(${statusText})`;
    const min = Math.floor(gameTime / 60).toString().padStart(2, '0');
    const sec = Math.floor(gameTime % 60).toString().padStart(2, '0');
    document.getElementById('mission-timer').textContent = `${min}:${sec}`;
    updateSelectedUI();
}

// ==================== РЕНДЕР ====================
function draw() {
    ctx.fillStyle = '#2d3a2e';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    ctx.fillStyle = '#33422f';
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    // Сетка 100 м
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1 / camera.zoom;
    for (let x = 0; x <= WORLD.width; x += 100) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.height); ctx.stroke();
    }
    for (let y = 0; y <= WORLD.height; y += 100) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.width, y); ctx.stroke();
    }

    // Сетка 500 м
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5 / camera.zoom;
    for (let x = 0; x <= WORLD.width; x += 500) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.height); ctx.stroke();
    }
    for (let y = 0; y <= WORLD.height; y += 500) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.width, y); ctx.stroke();
    }

    ctx.strokeStyle = '#777';
    ctx.lineWidth = 3 / camera.zoom;
    ctx.strokeRect(0, 0, WORLD.width, WORLD.height);

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `${10 / camera.zoom}px monospace`;
    ctx.textAlign = 'center';
    for (let x = 0; x <= WORLD.width; x += 500) ctx.fillText(`${x}м`, x, -8 / camera.zoom);
    ctx.textAlign = 'right';
    for (let y = 0; y <= WORLD.height; y += 500) ctx.fillText(`${y}м`, -8 / camera.zoom, y + 3 / camera.zoom);

    // Точка захвата
    ctx.beginPath();
    ctx.arc(objective.x, objective.y, objective.radius, 0, Math.PI * 2);
    ctx.fillStyle = objective.owner === 'RU' ? 'rgba(213,43,30,0.25)' :
                    objective.owner === 'US' ? 'rgba(60,110,182,0.25)' : 'rgba(255,215,0,0.15)';
    ctx.fill();
    ctx.strokeStyle = objective.owner === 'RU' ? '#d52b1e' :
                      objective.owner === 'US' ? '#3c6eb6' : '#ffd700';
    ctx.lineWidth = 2 / camera.zoom;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${20 / camera.zoom}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', objective.x, objective.y);

    if (objective.holdTime > 0) {
        const frac = Math.min(1, objective.holdTime / 3);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3 / camera.zoom;
        ctx.beginPath();
        ctx.arc(objective.x, objective.y, objective.radius + 8 / camera.zoom, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
        ctx.stroke();
    }

    // Линии строя
    if (Formation.current) {
        const cmd = ruUnits.find(u => u.role === 'commander' && !u.dead);
        if (cmd) {
            const alive = ruUnits.filter(u => !u.dead && u !== cmd);
            ctx.strokeStyle = Formation.current === 'march' ? 'rgba(120,200,255,0.25)' : 'rgba(255,180,120,0.25)';
            ctx.lineWidth = 1 / camera.zoom;
            alive.forEach(u => {
                ctx.beginPath(); ctx.moveTo(cmd.x, cmd.y); ctx.lineTo(u.x, u.y); ctx.stroke();
            });
        }
    }

    // Маршруты
    selectedUnits.forEach(u => {
        if (u.dead || !u.moveTarget) return;
        ctx.strokeStyle = 'rgba(255,215,0,0.5)';
        ctx.lineWidth = 1.5 / camera.zoom;
        ctx.setLineDash([6 / camera.zoom, 6 / camera.zoom]);
        ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.moveTarget.x, u.moveTarget.y); ctx.stroke();
        ctx.setLineDash([]);
    });

    // Пули
    bullets.forEach(b => {
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 1.5 / camera.zoom;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        const dx = b.tx - b.x, dy = b.ty - b.y;
        const d = Math.hypot(dx, dy) || 1;
        ctx.lineTo(b.x + (dx / d) * 40, b.y + (dy / d) * 40);
        ctx.stroke();
    });

    // Взрывы
    explosions.forEach(e => {
        const alpha = e.life / 0.5;
        ctx.fillStyle = `rgba(255, 100, 0, ${alpha * 0.6})`;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.radius * 0.4, 0, Math.PI * 2); ctx.fill();
    });

    allUnits.forEach(u => u.draw(ctx));

    // Прицел мыши
    if (mouse.x && mouse.y && !isTouch) {
        const wp = screenToWorld(mouse.x, mouse.y);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1 / camera.zoom;
        ctx.beginPath(); ctx.arc(wp.x, wp.y, 8 / camera.zoom, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.restore();
    drawMinimap();
}

function drawMinimap() {
    const mw = minimapCanvas.width, mh = minimapCanvas.height;
    mctx.fillStyle = '#1a2418';
    mctx.fillRect(0, 0, mw, mh);

    mctx.strokeStyle = 'rgba(255,255,255,0.1)';
    mctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
        mctx.beginPath(); mctx.moveTo(mw * i / 4, 0); mctx.lineTo(mw * i / 4, mh); mctx.stroke();
        mctx.beginPath(); mctx.moveTo(0, mh * i / 4); mctx.lineTo(mw, mh * i / 4); mctx.stroke();
    }

    const sx = mw / WORLD.width, sy = mh / WORLD.height;

    mctx.beginPath();
    mctx.arc(objective.x * sx, objective.y * sy, 8, 0, Math.PI * 2);
    mctx.fillStyle = objective.owner === 'RU' ? 'rgba(213,43,30,0.5)' :
                     objective.owner === 'US' ? 'rgba(60,110,182,0.5)' : 'rgba(255,215,0,0.3)';
    mctx.fill();
    mctx.strokeStyle = objective.owner === 'RU' ? '#d52b1e' :
                       objective.owner === 'US' ? '#3c6eb6' : '#ffd700';
    mctx.lineWidth = 1.5;
    mctx.stroke();

    allUnits.forEach(u => {
        if (u.dead) return;
        mctx.fillStyle = u.team === 'RU' ? '#d52b1e' : '#3c6eb6';
        mctx.beginPath(); mctx.arc(u.x * sx, u.y * sy, 2, 0, Math.PI * 2); mctx.fill();
    });

    const halfW = (W / 2) / camera.zoom, halfH = (H / 2) / camera.zoom;
    mctx.strokeStyle = 'rgba(255,255,255,0.8)';
    mctx.lineWidth = 1;
    mctx.strokeRect((camera.x - halfW) * sx, (camera.y - halfH) * sy, halfW * 2 * sx, halfH * 2 * sy);
}

// ==================== ЦИКЛ ====================
let lastTime = performance.now();
function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
}

init();
initInput();
setOrderMode('move');
requestAnimationFrame(loop);
