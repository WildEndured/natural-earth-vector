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

// ==================== ПАТФАЙНДИНГ (A*) ====================
const GRID_SIZE = 20;
const GRID_W = Math.ceil(WORLD.width / GRID_SIZE);
const GRID_H = Math.ceil(WORLD.height / GRID_SIZE);
let navigationGrid = [];

function rebuildNavigationGrid() {
    navigationGrid = [];
    for (let gy = 0; gy < GRID_H; gy++) {
        const row = [];
        for (let gx = 0; gx < GRID_W; gx++) {
            const cx = gx * GRID_SIZE + GRID_SIZE / 2;
            const cy = gy * GRID_SIZE + GRID_SIZE / 2;
            let blocked = false;
            for (const obs of obstacles) {
                if (obs.type === 'tree' || obs.type === 'bush') continue;
                const padding = 6;
                if (cx > obs.x - obs.w/2 - padding && cx < obs.x + obs.w/2 + padding &&
                    cy > obs.y - obs.h/2 - padding && cy < obs.y + obs.h/2 + padding) {
                    blocked = true; break;
                }
            }
            row.push(blocked ? 1 : 0);
        }
        navigationGrid.push(row);
    }
}

function gridToWorld(gx, gy) { return { x: gx * GRID_SIZE + GRID_SIZE / 2, y: gy * GRID_SIZE + GRID_SIZE / 2 }; }
function worldToGrid(x, y) { return { gx: Math.max(0, Math.min(GRID_W - 1, Math.floor(x / GRID_SIZE))), gy: Math.max(0, Math.min(GRID_H - 1, Math.floor(y / GRID_SIZE))) }; }
function isGridWalkable(gx, gy) { if (gx < 0 || gx >= GRID_W || gy < 0 || gy >= GRID_H) return false; return navigationGrid[gy][gx] === 0; }

function findPath(startX, startY, endX, endY) {
    const start = worldToGrid(startX, startY);
    const end = worldToGrid(endX, endY);
    let startG = start, endG = end;
    if (!isGridWalkable(startG.gx, startG.gy)) {
        let found = false;
        for (let r = 1; r < 5 && !found; r++) {
            for (let dx = -r; dx <= r && !found; dx++) for (let dy = -r; dy <= r && !found; dy++) {
                if (isGridWalkable(startG.gx + dx, startG.gy + dy)) { startG = { gx: startG.gx + dx, gy: startG.gy + dy }; found = true; }
            }
        }
        if (!found) return null;
    }
    if (!isGridWalkable(endG.gx, endG.gy)) {
        let found = false;
        for (let r = 1; r < 5 && !found; r++) {
            for (let dx = -r; dx <= r && !found; dx++) for (let dy = -r; dy <= r && !found; dy++) {
                if (isGridWalkable(endG.gx + dx, endG.gy + dy)) { endG = { gx: endG.gx + dx, gy: endG.gy + dy }; found = true; }
            }
        }
        if (!found) return null;
    }
    const open = [{ gx: startG.gx, gy: startG.gy, g: 0, h: Math.hypot(endG.gx - startG.gx, endG.gy - startG.gy), f: 0, parent: null }];
    const closed = new Set();
    const key = (g) => `${g.gx},${g.gy}`;
    while (open.length > 0) {
        open.sort((a, b) => a.f - b.f);
        const current = open.shift();
        const k = key(current);
        if (closed.has(k)) continue;
        closed.add(k);
        if (current.gx === endG.gx && current.gy === endG.gy) {
            const path = []; let node = current;
            while (node) { path.unshift(gridToWorld(node.gx, node.gy)); node = node.parent; }
            return path;
        }
        const neighbors = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: -1 }];
        for (const n of neighbors) {
            const ngx = current.gx + n.dx, ngy = current.gy + n.dy;
            if (!isGridWalkable(ngx, ngy)) continue;
            if (n.dx !== 0 && n.dy !== 0) {
                if (!isGridWalkable(current.gx + n.dx, current.gy) || !isGridWalkable(current.gx, current.gy + n.dy)) continue;
            }
            const nk = `${ngx},${ngy}`;
            if (closed.has(nk)) continue;
            const moveCost = (n.dx !== 0 && n.dy !== 0) ? 1.414 : 1;
            const g = current.g + moveCost;
            const h = Math.hypot(endG.gx - ngx, endG.gy - ngy);
            const existing = open.find(o => o.gx === ngx && o.gy === ngy);
            if (existing) { if (g < existing.g) { existing.g = g; existing.f = g + h; existing.parent = current; } }
            else open.push({ gx: ngx, gy: ngy, g, h, f: g + h, parent: current });
        }
    }
    return null;
}

// ==================== ЗВУК ====================
let audioCtx = null;
try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { console.warn('AudioContext недоступен:', e); }
function playSound(type) {
    if (!audioCtx) return;
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;
        if (type === 'shot') { osc.type = 'square'; osc.frequency.setValueAtTime(300 + Math.random()*100, now); osc.frequency.exponentialRampToValueAtTime(50, now + 0.1); gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1); osc.start(now); osc.stop(now + 0.1); }
        else if (type === 'mg') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200 + Math.random()*50, now); osc.frequency.exponentialRampToValueAtTime(40, now + 0.08); gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08); osc.start(now); osc.stop(now + 0.08); }
        else if (type === 'explosion') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now); osc.frequency.exponentialRampToValueAtTime(10, now + 0.5); gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5); osc.start(now); osc.stop(now + 0.5); }
        else if (type === 'hit') { osc.type = 'sine'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(200, now + 0.05); gain.gain.setValueAtTime(0.03, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05); osc.start(now); osc.stop(now + 0.05); }
    } catch(e) {}
}

// ==================== ОРУЖИЕ ====================
const WEAPONS = {
    ak74m:    { name: 'АК-74М', caliber: '5.45×39 мм', weight: 3.6, magSize: 30, maxAmmo: 180, effRange: 300, maxRange: 1000, fireRate: 0.6, rpm: 650, damage: 28, baseAccuracy: 0.85, reloadTime: 2.5, suppressionPower: 0.5, icon: '🔫' },
    ak74m_gp: { name: 'АК-74М + ГП-25', caliber: '5.45 / 40 мм', weight: 4.8, magSize: 30, maxAmmo: 180, glAmmo: 4, glRange: 400, glBlast: 6, effRange: 300, maxRange: 1000, fireRate: 0.6, rpm: 650, damage: 28, baseAccuracy: 0.8, reloadTime: 3.0, hasGL: true, suppressionPower: 0.5, icon: '🔫💥' },
    pkm:      { name: 'ПКП «Печенег»', caliber: '7.62×54 мм R', weight: 12.7, magSize: 100, maxAmmo: 400, effRange: 800, maxRange: 1500, fireRate: 0.12, rpm: 650, damage: 22, baseAccuracy: 0.7, reloadTime: 12.0, suppressionPower: 1.5, bipod: true, icon: '💥' },
    rpg7:     { name: 'РПГ-7В', caliber: '85 мм', weight: 6.3, magSize: 1, maxAmmo: 4, effRange: 330, maxRange: 700, fireRate: 6.0, rpm: 6, damage: 150, baseAccuracy: 0.9, reloadTime: 8.0, isAntiTank: true, blastRadius: 4, suppressionPower: 2.0, icon: '🚀' },
    m4a1:     { name: 'M4A1', caliber: '5.56×45 NATO', weight: 3.4, magSize: 30, maxAmmo: 210, effRange: 300, maxRange: 800, fireRate: 0.55, rpm: 700, damage: 26, baseAccuracy: 0.85, reloadTime: 2.2, suppressionPower: 0.5, icon: '🔫' },
    m4a1_gl:  { name: 'M4A1 + M320', caliber: '5.56 / 40 мм', weight: 4.9, magSize: 30, maxAmmo: 210, glAmmo: 4, glRange: 400, glBlast: 5, effRange: 300, maxRange: 800, fireRate: 0.55, rpm: 700, damage: 26, baseAccuracy: 0.82, reloadTime: 3.0, hasGL: true, suppressionPower: 0.5, icon: '🔫💥' },
    m249:     { name: 'M249 SAW', caliber: '5.56×45 NATO', weight: 10.2, magSize: 200, maxAmmo: 600, effRange: 600, maxRange: 1000, fireRate: 0.1, rpm: 750, damage: 18, baseAccuracy: 0.75, reloadTime: 6.0, suppressionPower: 1.0, bipod: true, icon: '💥' },
    m110:     { name: 'M110 SASS', caliber: '7.62×51 NATO', weight: 7.8, magSize: 10, maxAmmo: 60, effRange: 800, maxRange: 1500, fireRate: 1.8, rpm: 30, damage: 65, baseAccuracy: 0.95, reloadTime: 4.0, suppressionPower: 0.7, bipod: true, icon: '🎯' }
};

const CONFIG = {
    soldierRadius: 4, speed: 8, viewRange: 350, objectiveRadius: 60,
    formationInterval: 12, marchColumnGap: 4,
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
    },
    radio: { range: 200, orderDelay: 2.0, signalLossTime: 3.0, reportCooldown: 1.0, enemyMemory: 30.0, jamChance: 0.2 }
};

// ==================== СОСТОЯНИЕ ====================
let ruUnits = [], usUnits = [], allUnits = [], selectedUnits = [], bullets = [], explosions = [], damageTexts = [];
let objective = { x: 0, y: 0, radius: 60, owner: 'neutral', holdTime: 0 };
let gameTime = 0, gameOver = false, orderMode = 'move';
let globalAIMode = true;
let ruRadio = null, usRadio = null;

// ==================== РАДИО ====================
class Radio {
    constructor(name, range) { this.name = name; this.range = range; this.jammed = false; this.members = []; }
    add(u) { this.members.push(u); u.radio = this; }
    broadcast(sender, type, data) {
        if (this.jammed) return;
        if (Math.random() < CONFIG.radio.jamChance) return;
        this.members.forEach(u => {
            if (u === sender || u.dead) return;
            const d = Math.hypot(u.x - sender.x, u.y - sender.y);
            if (d > this.range) return;
            u.receiveReport(sender, type, data);
        });
    }
    reset() { this.jammed = false; this.members = []; }
}

function addReport(text, color = '#fff') {
    const log = document.getElementById('reports-log');
    if (!log) return;
    const el = document.createElement('div');
    el.style.color = color;
    const min = Math.floor(gameTime / 60).toString().padStart(2, '0');
    const sec = Math.floor(gameTime % 60).toString().padStart(2, '0');
    el.textContent = `[${min}:${sec}] ${text}`;
    log.appendChild(el);
    if (log.children.length > 6) log.removeChild(log.firstChild);
    setTimeout(() => el.remove(), 6000);
}

function showStatus(msg) { const el = document.getElementById('status-message'); if (!el) return; el.textContent = msg; clearTimeout(showStatus._t); showStatus._t = setTimeout(() => { el.textContent = ''; }, 2500); }

// ==================== ГРУППЫ США ====================
const USGroups = {
    A: 'fire', B: 'maneuver', roleNames: { fire: 'огонь', maneuver: 'маневр' }, _lastSwitch: 0,
    reset() { this.A = 'fire'; this.B = 'maneuver'; this._lastSwitch = 0; },
    switchRoles() {
        const now = performance.now();
        if (now - this._lastSwitch < 2000) return;
        this._lastSwitch = now;
        this.A = this.A === 'fire' ? 'maneuver' : 'fire';
        this.B = this.B === 'fire' ? 'maneuver' : 'fire';
        (typeof usUnits !== 'undefined' ? usUnits : []).forEach(u => {
            u._reachedFirePos = false; u._reachedManeuver = false; u._reachedBound = false;
            u._boundIndex = 0; u._bounds = null; u._firePos = null; u._maneuverPos = null;
            u.isSuppressing = false; u.phaseTimer = 0;
        });
        showStatus('🇺🇸 Смена ролей: огонь ↔ маневр');
        addReport('🇺🇸 Смена ролей', '#66ff66');
        const el = document.getElementById('us-groups');
        if (el) el.textContent = `А: ${this.roleNames[this.A]} · Б: ${this.roleNames[this.B]}`;
    },
    evaluateAndSwitch(usUnits) {
        const manGroupId = this.A === 'maneuver' ? 'A' : 'B';
        const manLeader = usUnits.find(u => u.groupId === manGroupId && u.role === 'team_leader' && !u.dead);
        if (manLeader && manLeader._bounds && !manLeader._reachedBound) return;
        
        const aliveA = usUnits.filter(u => !u.dead && u.groupId === 'A');
        const aliveB = usUnits.filter(u => !u.dead && u.groupId === 'B');
        if (this.A === 'fire' && aliveA.length < 2 && aliveB.length >= 2) this.switchRoles();
        else if (this.B === 'fire' && aliveB.length < 2 && aliveA.length >= 2) this.switchRoles();
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
    rebuildNavigationGrid();
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
            else { const r = q[i] / p[i]; if (p[i] < 0) { if (r > t1) { intersects = false; break; } if (r > t0) t0 = r; } else { if (r < t0) { intersects = false; break; } if (r < t1) t1 = r; } }
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
    current: 'march', reset() { this.current = 'march'; }, lastUpdate: 0,
    apply(commander) {
        if (!commander || commander.dead) return;
        let dir = commander.facing;
        if (commander.moveTarget) dir = Math.atan2(commander.moveTarget.y - commander.y, commander.moveTarget.x - commander.x);
        const alive = ruUnits.filter(u => !u.dead); const followers = alive.filter(u => u !== commander);
        followers.sort((a, b) => a.roleName.localeCompare(b.roleName)); const total = followers.length;
        const interval = CONFIG.formationInterval;
        if (this.current === 'march') {
            const backAngle = dir + Math.PI;
            followers.forEach((u, i) => {
                const distBack = (i + 1) * CONFIG.marchColumnGap;
                const lateralOffset = (i % 2 === 0 ? 1 : -1) * 4;
                u.formationPos = { x: commander.x + Math.cos(backAngle) * distBack + Math.cos(backAngle + Math.PI/2) * lateralOffset, y: commander.y + Math.sin(backAngle) * distBack + Math.sin(backAngle + Math.PI/2) * lateralOffset };
                u.moveTarget = null; u.followTarget = null;
            });
        } else {
            const perpAngle = dir + Math.PI / 2;
            followers.forEach((u, i) => {
                const idx = i - (total - 1) / 2; const lateral = idx * interval; const backOffset = 8;
                u.formationPos = { x: commander.x + Math.cos(perpAngle) * lateral + Math.cos(dir + Math.PI) * backOffset, y: commander.y + Math.sin(perpAngle) * lateral + Math.sin(dir + Math.PI) * backOffset };
                u.moveTarget = null; u.followTarget = null;
            });
        }
    }
};

// ==================== ИИ ====================
function updateSquadAI(dt, units, isRussian) {
    const alive = units.filter(u => !u.dead); if (alive.length === 0) return;
    if (!isRussian) USGroups.evaluateAndSwitch(units);
    let leader = alive.find(u => u.role === 'commander' || u.role === 'squad_leader');
    if (!leader) {
        leader = alive[0]; leader.role = isRussian ? 'commander' : 'squad_leader'; leader.roleName = 'И.о. ком. отделения';
        alive.forEach(u => { u.panicTimer = 3.0; u.morale = Math.max(0, u.morale - CONFIG.morale.decayLeaderLoss); u.combatStress = Math.min(100, u.combatStress + 20); u.radioJamTimer = CONFIG.radio.signalLossTime; });
        showStatus(isRussian ? '🇷🇺 Потерян командир!' : '🇺🇸 Потерян командир!');
        addReport(isRussian ? 'Потерян командир РФ! Связь на 3 сек' : 'Потерян командир США!', '#ff4444');
    }
    if (leader.manualControl) return;

    leader.knownEnemies = leader.knownEnemies.filter(e => performance.now() - e.time < CONFIG.radio.enemyMemory * 1000);
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

    if (leader && !leader.target && !leader.manualControl) {
        if (leader.knownEnemies.length > 0) {
            const nearest = leader.knownEnemies.reduce((a, b) => (Math.hypot(a.x - leader.x, a.y - leader.y) < Math.hypot(b.x - leader.x, b.y - leader.y) ? a : b));
            leader.moveTarget = { x: nearest.x, y: nearest.y };
        } else { leader.moveTarget = { x: objective.x, y: objective.y }; }
    }

    if (isRussian) {
        const fl = groupLeaders.fire, ml = groupLeaders.maneuver;
        if (fl && !fl.manualControl) {
            if (!fl._firePos) {
                let fx = objective.x + 150, fy = objective.y - 150;
                if (pointInObstacle(fx, fy)) { fx = objective.x + 80; fy = objective.y - 80; }
                fl._firePos = { x: fx, y: fy };
            }
            if (!fl._reachedFirePos) {
                if (!fl.moveTarget) fl.moveTarget = { ...fl._firePos };
                if (Math.hypot(fl.x - fl._firePos.x, fl.y - fl._firePos.y) < 30) { fl._reachedFirePos = true; fl.moveTarget = null; fl.holding = true; fl.phaseTimer = 2.5; fl.report('position_reached', { group: 'fire' }); addReport('🇷🇺 Огневая группа на позиции', '#ffaa55'); }
            } else {
                alive.filter(u => u.groupId === 'fire' && (!u.target || u.distanceTo(u.target) > u.weapon.effRange) && !u.manualControl).forEach(u => { u.isSuppressing = true; u.suppressionTargetPos = { x: objective.x, y: objective.y }; });
            }
        }
        if (ml && !ml.manualControl) {
            const fireReady = fl && fl._reachedFirePos && fl.phaseTimer <= 0;
            if (!fireReady) { ml.holding = true; }
            else {
                ml.holding = false;
                if (!ml._bounds) { ml._bounds = [{ x: objective.x - 80, y: objective.y + 80 }, { x: objective.x - 40, y: objective.y + 40 }, { x: objective.x, y: objective.y }]; ml._boundIndex = 0; ml._reachedBound = false; }
                const bound = ml._bounds[ml._boundIndex];
                if (!bound) {
                    alive.forEach(u => {
                        if (u.groupId === 'fire') u.groupId = 'maneuver'; else if (u.groupId === 'maneuver') u.groupId = 'fire';
                        u._reachedFirePos = false; u._reachedManeuver = false; u._reachedBound = false; u._boundIndex = 0; u._bounds = null; u._firePos = null; u._maneuverPos = null; u.isSuppressing = false; u.phaseTimer = 0;
                    });
                    addReport('🇷🇺 Смена ролей: огонь ↔ маневр', '#66ff66');
                } else if (!ml._reachedBound) {
                    if (!ml.moveTarget) ml.moveTarget = { ...bound };
                    if (Math.hypot(ml.x - bound.x, ml.y - bound.y) < 25) { ml._reachedBound = true; ml.moveTarget = null; ml.phaseTimer = 1.5; ml.report('position_reached', { group: 'maneuver', bound: ml._boundIndex }); }
                } else if (ml.phaseTimer <= 0) { ml._boundIndex++; ml._reachedBound = false; }
            }
        }
    } else {
        const fireGroupId = USGroups.A === 'fire' ? 'A' : 'B';
        const manGroupId = USGroups.A === 'maneuver' ? 'A' : 'B';
        const fireLeader = groupLeaders[fireGroupId], manLeader = groupLeaders[manGroupId];

        if (fireLeader && !fireLeader.manualControl) {
            if (!fireLeader._firePos) {
                const angle = fireGroupId === 'A' ? -Math.PI/4 : Math.PI/4;
                let fx = objective.x + Math.cos(angle) * 150, fy = objective.y + Math.sin(angle) * 150;
                if (pointInObstacle(fx, fy)) { fx = objective.x + Math.cos(angle) * 80; fy = objective.y + Math.sin(angle) * 80; }
                fireLeader._firePos = { x: fx, y: fy };
            }
            if (!fireLeader._reachedFirePos) {
                if (!fireLeader.moveTarget) fireLeader.moveTarget = { ...fireLeader._firePos };
                if (Math.hypot(fireLeader.x - fireLeader._firePos.x, fireLeader.y - fireLeader._firePos.y) < 30) { fireLeader._reachedFirePos = true; fireLeader.moveTarget = null; fireLeader.holding = true; fireLeader.phaseTimer = 2.5; fireLeader.report('position_reached', { group: fireGroupId }); addReport('🇺🇸 Fire-группа на позиции', '#66aaff'); }
            } else {
                alive.filter(u => u.groupId === fireGroupId && (!u.target || u.distanceTo(u.target) > u.weapon.effRange) && !u.manualControl).forEach(u => { u.isSuppressing = true; u.suppressionTargetPos = { x: objective.x, y: objective.y }; });
            }
        }
        if (manLeader && !manLeader.manualControl) {
            const fireReady = fireLeader && fireLeader._reachedFirePos && fireLeader.phaseTimer <= 0;
            if (!fireReady) { manLeader.holding = true; }
            else {
                manLeader.holding = false;
                if (!manLeader._bounds) {
                    const angle = manGroupId === 'A' ? -Math.PI/3 : Math.PI/3;
                    const bp = [{ x: objective.x + Math.cos(angle) * 80, y: objective.y + Math.sin(angle) * 80 }, { x: objective.x + Math.cos(angle) * 40, y: objective.y + Math.sin(angle) * 40 }, { x: objective.x, y: objective.y }];
                    manLeader._bounds = bp.map(p => pointInObstacle(p.x, p.y) ? { x: objective.x, y: objective.y } : p);
                    manLeader._boundIndex = 0; manLeader._reachedBound = false;
                }
                const bound = manLeader._bounds[manLeader._boundIndex];
                if (!bound) { addReport('🇺🇸 Maneuver достигла объекта', '#66ff66'); USGroups.switchRoles(); }
                else if (!manLeader._reachedBound) {
                    if (!manLeader.moveTarget) manLeader.moveTarget = { ...bound };
                    if (Math.hypot(manLeader.x - bound.x, manLeader.y - bound.y) < 25) { manLeader._reachedBound = true; manLeader.moveTarget = null; manLeader.phaseTimer = 1.5; manLeader.report('position_reached', { group: manGroupId, bound: manLeader._boundIndex }); }
                } else if (manLeader.phaseTimer <= 0) { manLeader._boundIndex++; manLeader._reachedBound = false; }
            }
        }
    }

    // === ФОРМАЦИЯ РФ (исправлено: не трогаем moveTarget, только formationPos) ===
    if (isRussian) {
        const cmd = alive.find(u => u.role === 'commander');
        const fl = groupLeaders.fire;
        const ml = groupLeaders.maneuver;
        if (cmd && !cmd.manualControl) {
            const excluded = new Set([cmd, ml, fl].filter(Boolean));
            const followers = alive.filter(u => 
                !excluded.has(u) && 
                !u.manualControl && 
                !u.isSuppressing && 
                !(u._bounds && u._bounds.length > 0) &&
                !u._hasActiveOrder
            );
            const total = Math.max(1, followers.length);
            followers.forEach((u, i) => {
                const angle = (i / total) * Math.PI * 2 + cmd.facing;
                const radius = 12 + (i % 2) * 6;
                u.formationPos = { x: cmd.x + Math.cos(angle) * radius, y: cmd.y + Math.sin(angle) * radius };
            });
        }
    }
    // === ФОРМАЦИЯ США ===
    else {
        ['A', 'B'].forEach(gid => {
            const gl = groupLeaders[gid]; 
            if (!gl || gl.dead) return;
            const groupUnits = alive.filter(u => 
                u.groupId === gid && 
                u !== gl && 
                !u.manualControl && 
                !u.isSuppressing && 
                !(u._bounds && u._bounds.length > 0) &&
                !u._hasActiveOrder
            );
            const total = Math.max(1, groupUnits.length);
            groupUnits.forEach((u, i) => {
                const angle = (i / total) * Math.PI * 2 + gl.facing;
                const radius = 10 + (i % 2) * 5;
                u.formationPos = { x: gl.x + Math.cos(angle) * radius, y: gl.y + Math.sin(angle) * radius };
            });
        });
        
        // Team leaders следуют за squad_leader, если далеко
        if (leader && !leader.manualControl) {
            ['A', 'B'].forEach(gid => {
                const gl = groupLeaders[gid];
                if (gl && !gl.dead && !gl.manualControl) {
                    const d = Math.hypot(gl.x - leader.x, gl.y - leader.y);
                    if (d > 60) {
                        gl.moveTarget = { x: leader.x + (Math.random()-0.5)*20, y: leader.y + (Math.random()-0.5)*20 };
                        gl._reachedFirePos = false;
                        gl._reachedManeuver = false;
                        gl._bounds = null;
                        gl._boundIndex = 0;
                        gl.isSuppressing = false;
                    }
                }
            });
        }
    }

    // Снайпер
    const sniper = alive.find(u => u.weaponId === 'm110');
    if (sniper && leader && !sniper._hasSniperPos && !sniper.manualControl) { 
        const backAngle = leader.facing + Math.PI; 
        sniper.moveTarget = { x: leader.x + Math.cos(backAngle) * 40, y: leader.y + Math.sin(backAngle) * 40 }; 
        sniper._hasSniperPos = true; 
    }
}
function updateUSAI(dt) { updateSquadAI(dt, usUnits, false); }
function updateRUAI(dt) { updateSquadAI(dt, ruUnits, true); }

// ==================== РЕНДЕР ====================
function screenToWorld(sx, sy) { return { x: (sx - W / 2) / camera.zoom + camera.x, y: (sy - H / 2) / camera.zoom + camera.y }; }
function worldToScreen(wx, wy) { return { x: (wx - camera.x) * camera.zoom + W / 2, y: (wy - camera.y) * camera.zoom + H / 2 }; }
function clampCamera() {
    if (!W || !H) return;
    const halfW = (W / 2) / camera.zoom, halfH = (H / 2) / camera.zoom;
    if (WORLD.width * camera.zoom < W) camera.x = WORLD.width / 2; else camera.x = Math.max(halfW, Math.min(WORLD.width - halfW, camera.x));
    if (WORLD.height * camera.zoom < H) camera.y = WORLD.height / 2; else camera.y = Math.max(halfH, Math.min(WORLD.height - halfH, camera.y));
}
function zoomAt(sx, sy, factor) {
    const before = screenToWorld(sx, sy);
    camera.zoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, camera.zoom * factor));
    const after = screenToWorld(sx, sy);
    camera.x += before.x - after.x; camera.y += before.y - after.y; clampCamera();
}

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
    ctx.fillStyle = objective.owner === 'RU' ? 'rgba(213,43,30,0.25)' : objective.owner === 'US' ? 'rgba(60,110,182,0.25)' : 'rgba(255,215,0,0.15)'; ctx.fill();
    ctx.strokeStyle = objective.owner === 'RU' ? '#d52b1e' : objective.owner === 'US' ? '#3c6eb6' : '#ffd700'; ctx.lineWidth = 2 / camera.zoom; ctx.stroke();
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

// ==================== ВВОД ====================
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
        if (Math.hypot(u.x - wp.x, u.y - wp.y) < tapRadius) { selectedUnits.forEach(s => { s.moveTarget = { x: u.x, y: u.y }; s.holding = false; s._hasActiveOrder = true; }); showStatus(`Атака: ${u.roleName}`); showOrderHint(wp.x, wp.y, 'attack'); return; }
    }
    executeOrderAt(wp.x, wp.y);
}

function executeOrderAt(wx, wy) {
    if (globalAIMode) { showStatus('Сначала перехватите управление (ИИ: ВЫКЛ)'); return; }
    const controllable = selectedUnits.filter(u => u.manualControl && !u.dead);
    if (controllable.length === 0) { showStatus('Нет солдат под управлением'); return; }
    const commander = ruUnits.find(u => u.role === 'commander' && !u.dead && u.manualControl)
        || usUnits.find(u => u.role === 'squad_leader' && !u.dead && u.manualControl);
    if (orderMode === 'move') {
        if (commander) { commander.pendingOrder = { type: 'move', x: wx, y: wy, time: CONFIG.radio.orderDelay }; showStatus('Приказ передан (2 с)...'); }
        else controllable.forEach(u => { u.moveTarget = { x: wx, y: wy }; u.followTarget = null; u.holding = false; u.aimTimer = 0; u._hasActiveOrder = true; });
        showOrderHint(wx, wy, 'move');
    } else if (orderMode === 'attack') {
        controllable.forEach(u => { u.moveTarget = { x: wx, y: wy }; u.holding = false; u.aimTimer = 0; u._hasActiveOrder = true; });
        showStatus('Атака'); showOrderHint(wx, wy, 'attack');
    } else if (orderMode === 'hold') {
        controllable.forEach(u => { u.moveTarget = { x: u.x, y: u.y }; u.followTarget = null; u.holding = true; u.formationPos = null; u.aimTimer = 0; u._hasActiveOrder = false; });
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

function handleLeftClick(wx, wy) {
    for (const u of allUnits) { if (u.dead || u.team !== 'RU') continue; if (Math.hypot(u.x - wx, u.y - wy) < u.radius + 4 / camera.zoom) { selectedUnits = [u]; updateSelectedUI(); return; } }
    for (const u of allUnits) { if (u.dead || u.team !== 'US') continue; if (Math.hypot(u.x - wx, u.y - wy) < u.radius + 5 / camera.zoom) { selectedUnits.forEach(s => { s.moveTarget = { x: u.x, y: u.y }; s.holding = false; s._hasActiveOrder = true; }); showStatus(`Атака: ${u.roleName}`); return; } }
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
}

// ==================== UI ====================
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

function toggleAIMode() {
    const btn = document.getElementById('btn-ai-mode');
    if (globalAIMode) {
        const aliveSelected = selectedUnits.filter(u => !u.dead);
        if (aliveSelected.length === 0) { showStatus('Выберите живого солдата'); return; }
        selectedUnits = aliveSelected;
        const isCmd = selectedUnits.some(u => u.role === 'commander');
        if (isCmd) { ruUnits.forEach(u => { if (!u.dead) u.manualControl = true; }); showStatus('Ручное управление отделением'); addReport('РФ: управление перехвачено', '#ffd700'); }
        else { selectedUnits.forEach(u => u.manualControl = true); showStatus(`Ручное: ${selectedUnits[0].roleName}`); }
        globalAIMode = false; btn.textContent = 'ИИ: ВЫКЛ'; btn.style.background = '#6a3a3a';
    } else {
        ruUnits.forEach(u => { u.manualControl = false; u.moveTarget = null; u.followTarget = null; u.holding = false; u.formationPos = null; u._hasActiveOrder = false; });
        globalAIMode = true; btn.textContent = 'ИИ: ВКЛ'; btn.style.background = '#4a3a6a'; showStatus('Управление ИИ');
    }
}

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
        const jamIcon = u.radioJamTimer > 0 ? '📵' : '';
        el.innerHTML = `<b>${u.roleName}</b> | HP ${Math.ceil(u.hp)} | ${stanceName}` +
                       (aimPct > 5 ? ` | 🎯 ${aimPct}%` : '') +
                       (u.suppressionLevel > 40 ? ' | ПОДАВЛЕН' : '') +
                       (moralePct < 100 ? ` | ${moraleIcon} ${moralePct}%` : '') +
                       (jamIcon ? ` | ${jamIcon} СВЯЗЬ` : '') +
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

function initUI() {
    const fBtn = document.getElementById('btn-formation'); if (fBtn) fBtn.addEventListener('click', (e) => { e.preventDefault(); setFormation(Formation.current === 'march' ? 'battle' : 'march'); }); updateFormationButton();
    const aiBtn = document.getElementById('btn-ai-mode'); if (aiBtn) aiBtn.addEventListener('click', (e) => { e.preventDefault(); toggleAIMode(); });
    const stanceMap = { 'btn-stand': 'stand', 'btn-crouch': 'crouch', 'btn-prone': 'prone' };
    Object.entries(stanceMap).forEach(([id, stance]) => { const btn = document.getElementById(id); if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setStanceForSelected(stance); }); });
    const orderBtns = { 'btn-move': 'move', 'btn-attack': 'attack', 'btn-hold': 'hold', 'btn-follow': 'follow' };
    Object.entries(orderBtns).forEach(([id, mode]) => { const btn = document.getElementById(id); if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setOrderMode(mode); }); });
    const reloadBtn = document.getElementById('btn-reload'); if (reloadBtn) reloadBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); selectedUnits.forEach(u => { if (u.dead || u.isReloading) return; if (u.ammo < u.weapon.maxAmmo) { u.isReloading = true; u.reloadTimer = u.weapon.reloadTime || 2.0; u.aimTimer = 0; } }); showStatus('Перезарядка'); });
}

// ==================== ОТРЯДЫ ====================
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

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
function init() {
    USGroups.reset();
    Formation.reset();
    Formation.lastUpdate = 0;
    globalAIMode = true;
    bullets.length = 0; explosions.length = 0; damageTexts.length = 0;
    gameTime = 0; gameOver = false;
    if (ruRadio) { ruRadio.reset(); }
    if (usRadio) { usRadio.reset(); }
    resize();
    ruUnits = createRussianSquad(150, 850);
    usUnits = createUSSquad(850, 150);
    allUnits = [...ruUnits, ...usUnits];
    objective = { x: WORLD.width / 2, y: WORLD.height / 2, radius: CONFIG.objectiveRadius, owner: 'neutral', holdTime: 0 };
    selectedUnits = [ruUnits[0]];
    ruRadio = new Radio('RU_Squad', CONFIG.radio.range);
    usRadio = new Radio('US_Squad', CONFIG.radio.range);
    ruUnits.forEach(u => ruRadio.add(u));
    usUnits.forEach(u => usRadio.add(u));
    const fitZoom = Math.min(W / WORLD.width, H / WORLD.height) * 0.95;
    camera.zoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, fitZoom));
    camera.x = WORLD.width / 2; camera.y = WORLD.height / 2;
    clampCamera(); updateUI();
    const aiBtn = document.getElementById('btn-ai-mode');
    if (aiBtn) { aiBtn.textContent = 'ИИ: ВКЛ'; aiBtn.style.background = '#4a3a6a'; }
}

function resolveCollisions() {
    for (let i = 0; i < allUnits.length; i++) {
        const a = allUnits[i]; if (a.dead) continue;
        for (let j = i + 1; j < allUnits.length; j++) {
            const b = allUnits[j]; if (b.dead) continue;
            if (a.team === b.team && a.holding && b.holding) continue;
            const dx = b.x - a.x, dy = b.y - a.y; const distSq = dx * dx + dy * dy;
            const rA = a.radius * CONFIG.stanceModifiers[a.stance].collisionMult;
            const rB = b.radius * CONFIG.stanceModifiers[b.stance].collisionMult;
            const minDist = rA + rB + 1.0; const minDistSq = minDist * minDist;
            if (distSq < minDistSq && distSq > 0.001) {
                const dist = Math.sqrt(distSq); 
                const overlap = (minDist - dist) * 0.2;
                const nx = dx / dist, ny = dy / dist;
                a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
            }
        }
    }
}

function checkObjective(dt) {
    const ruNear = ruUnits.filter(u => !u.dead && u.moraleState !== 'surrendered' && u.moraleState !== 'routing' && Math.hypot(u.x - objective.x, u.y - objective.y) < objective.radius).length;
    const usNear = usUnits.filter(u => !u.dead && u.moraleState !== 'surrendered' && u.moraleState !== 'routing' && Math.hypot(u.x - objective.x, u.y - objective.y) < objective.radius).length;
    if (ruNear > 0 && usNear === 0) { if (objective.owner !== 'RU') { objective.holdTime += dt; if (objective.holdTime > 3) { objective.owner = 'RU'; objective.holdTime = 0; addReport('🇷🇺 Точка захвачена РФ', '#d52b1e'); } } }
    else if (usNear > 0 && ruNear === 0) { if (objective.owner !== 'US') { objective.holdTime += dt; if (objective.holdTime > 3) { objective.owner = 'US'; objective.holdTime = 0; addReport('🇺🇸 Точка захвачена США', '#3c6eb6'); } } }
    else objective.holdTime = Math.max(0, objective.holdTime - dt);
}

function endGame(team) {
    gameOver = true;
    document.getElementById('game-over').classList.remove('hidden');
    document.getElementById('result-text').textContent = team === 'RU' ? '🏆 Победа России!' : '🏆 Победа США!';
    addReport(team === 'RU' ? 'Победа России!' : 'Победа США!', team === 'RU' ? '#d52b1e' : '#3c6eb6');
}

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
    for (let i = bullets.length - 1; i >= 0; i--) { bullets[i].life -= dt; if (bullets[i].life <= 0) bullets.splice(i, 1); }
    for (let i = explosions.length - 1; i >= 0; i--) { explosions[i].life -= dt; if (explosions[i].life <= 0) explosions.splice(i, 1); }
    for (let i = damageTexts.length - 1; i >= 0; i--) { damageTexts[i].y -= 20 * dt; damageTexts[i].life -= dt; if (damageTexts[i].life <= 0) damageTexts.splice(i, 1); }
    checkObjective(dt);
    const ruAlive = ruUnits.filter(u => !u.dead).length;
    const usAlive = usUnits.filter(u => !u.dead).length;
    if (ruAlive === 0) endGame('US'); else if (usAlive === 0) endGame('RU');
    updateUI();
}

let lastTime = performance.now();
function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
}

function startGameWithMap(mapType) {
    try {
        document.getElementById('map-select').style.display = 'none';
        generateMap(mapType);
        init();
        initInput();
        initUI();
        setOrderMode('move');
        requestAnimationFrame(loop);
    } catch (e) {
        console.error('Ошибка запуска игры:', e);
        alert('Ошибка запуска: ' + e.message);
        const ms = document.getElementById('map-select');
        if (ms) ms.style.display = 'flex';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const maps = [
        { id: 'map-open', type: 'open' },
        { id: 'map-forest', type: 'forest' },
        { id: 'map-city', type: 'city' }
    ];
    maps.forEach(({ id, type }) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); startGameWithMap(type); });
        else console.warn('Кнопка карты не найдена:', id);
    });
});
