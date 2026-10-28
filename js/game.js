// ==================== GAME.JS ====================
// Основной класс Game. Управляет всем. Чистая архитектура.

// ---------- Squad (отделение) ----------
class Squad {
    constructor(team, name) {
        this.team = team;
        this.name = name;
        this.units = [];
        this.leader = null;
        this.radio = new Radio(`${team}_${name}`, TACTICS.radio.range);
        this.groups = {};              // groupId -> [units]
        this.tactic = 'idle';          // idle | advance | fire_maneuver | assault
        this.phase = 'init';           // для fire/maneuver
        this.phaseTimer = 0;
        this.objective = null;
        this._firePos = null;
        this._manPos = null;
        this._manBounds = null;
        this._manBoundIndex = 0;
    }
    
    addUnit(u) {
        this.units.push(u);
        this.radio.add(u);
        if (!this.groups[u.groupId]) this.groups[u.groupId] = [];
        this.groups[u.groupId].push(u);
        if (u.role === 'commander' || u.role === 'squad_leader') this.leader = u;
    }
    
    aliveUnits() { return this.units.filter(u => !u.dead); }
    
    aliveInGroup(gid) { return (this.groups[gid] || []).filter(u => !u.dead); }
    
    // Назначить нового командира
    promoteLeader() {
        const alive = this.aliveUnits();
        if (alive.length === 0) return false;
        const oldLeader = this.leader;
        this.leader = alive[0];
        this.leader.role = this.team === 'RU' ? 'commander' : 'squad_leader';
        this.leader.roleName = 'И.о. ком. отделения';
        alive.forEach(u => {
            u.panicTimer = 3.0;
            u.morale = Math.max(0, u.morale - TACTICS.morale.decayLeaderLoss);
            u.combatStress = Math.min(100, u.combatStress + 20);
            u.radioJamTimer = TACTICS.radio.signalLossTime;
        });
        return true;
    }
}

// ---------- Game ----------
const GAME = {
    canvas: null, ctx: null,
    minimap: null, mctx: null,
    W: 0, H: 0,
    camera: { x: WORLD.width / 2, y: WORLD.height / 2, zoom: 0.8, minZoom: 0.3, maxZoom: 4.0, panSpeed: 800 },
    obstacles: [],
    decorations: [],
    bullets: [],
    explosions: [],
    damageTexts: [],
    squads: [],
    allUnits: [],
    selectedUnits: [],
    objective: { x: WORLD.width / 2, y: WORLD.height / 2, radius: TACTICS.objectiveRadius, owner: 'neutral', holdTime: 0 },
    mapType: 'open',
    gameTime: 0,
    gameOver: false,
    orderMode: 'move',
    globalAIMode: true,
    mouse: { x: 0, y: 0 },
    keys: {},
    isTouch: false,
    _lastTime: 0,
    
    // ---------- INIT ----------
    init(canvas, minimap) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.minimap = minimap;
        this.mctx = minimap.getContext('2d');
        minimap.width = 180; minimap.height = 180;
        this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.setupInput();
    },
    
    resize() {
        this.W = this.canvas.width = window.innerWidth;
        this.H = this.canvas.height = window.innerHeight;
        this.clampCamera();
    },
    
    // ---------- START ----------
    start(mapType) {
        this.mapType = mapType;
        this.generateMap(mapType);
        this.gameTime = 0;
        this.gameOver = false;
        this.bullets = []; this.explosions = []; this.damageTexts = [];
        this.squads = [];
        this.allUnits = [];
        this.selectedUnits = [];
        this.objective = { x: WORLD.width / 2, y: WORLD.height / 2, radius: TACTICS.objectiveRadius, owner: 'neutral', holdTime: 0 };
        this.globalAIMode = true;
        
        this.createSquads();
        
        const fitZoom = Math.min(this.W / WORLD.width, this.H / WORLD.height) * 0.95;
        this.camera.zoom = Math.max(this.camera.minZoom, Math.min(this.camera.maxZoom, fitZoom));
        this.camera.x = WORLD.width / 2;
        this.camera.y = WORLD.height / 2;
        this.clampCamera();
        
        this._lastTime = performance.now();
        requestAnimationFrame(t => this.loop(t));
    },
    
    createSquads() {
        // RU
        const ru = new Squad('RU', '1-е отделение');
        const ruDefs = [
            { role: 'commander', roleName: 'Ком. отделения', weaponId: 'ak74m', groupId: 'cmd' },
            { role: 'deputy', roleName: 'Зам. ком. (ст. стрелок)', weaponId: 'ak74m_gp', groupId: 'cmd' },
            { role: 'medic', roleName: 'Санитар-стрелок', weaponId: 'ak74m', groupId: 'cmd' },
            { role: 'mg', roleName: 'Пулеметчик', weaponId: 'pkm', groupId: 'fire' },
            { role: 'grenadier', roleName: 'Гранатометчик', weaponId: 'rpg7', groupId: 'fire' },
            { role: 'assistant_grenadier', roleName: 'Пом. гранатометчика', weaponId: 'ak74m', groupId: 'fire' },
            { role: 'rifleman', roleName: 'Стрелок', weaponId: 'ak74m', groupId: 'maneuver' },
            { role: 'rifleman', roleName: 'Стрелок', weaponId: 'ak74m', groupId: 'maneuver' },
            { role: 'bmp_gunner', roleName: 'Наводчик-оператор БМП', weaponId: 'ak74m', groupId: 'crew' },
            { role: 'bmp_driver', roleName: 'Механик-водитель БМП', weaponId: 'ak74m', groupId: 'crew' }
        ];
        ruDefs.forEach((def, i) => {
            const angle = (i / ruDefs.length) * Math.PI * 2;
            const u = new Soldier({
                x: 150 + Math.cos(angle) * 20,
                y: 850 + Math.sin(angle) * 20,
                team: 'RU', ...def
            });
            ru.addUnit(u);
            this.allUnits.push(u);
        });
        this.squads.push(ru);
        
        // US
        const us = new Squad('US', '1st Squad');
        const usDefs = [
            { role: 'squad_leader', roleName: 'Ком. отделения', weaponId: 'm4a1', groupId: 'cmd' },
            { role: 'team_leader', roleName: 'Ком. группы А', weaponId: 'm4a1_gl', groupId: 'A' },
            { role: 'mg', roleName: 'Пулеметчик А', weaponId: 'm249', groupId: 'A' },
            { role: 'grenadier', roleName: 'Гренадер А', weaponId: 'm4a1_gl', groupId: 'A' },
            { role: 'rifleman', roleName: 'Стрелок А', weaponId: 'm4a1', groupId: 'A' },
            { role: 'team_leader', roleName: 'Ком. группы Б', weaponId: 'm4a1_gl', groupId: 'B' },
            { role: 'mg', roleName: 'Пулеметчик Б', weaponId: 'm249', groupId: 'B' },
            { role: 'grenadier', roleName: 'Гренадер Б', weaponId: 'm4a1_gl', groupId: 'B' },
            { role: 'rifleman', roleName: 'Стрелок Б', weaponId: 'm4a1', groupId: 'B' }
        ];
        usDefs.forEach((def, i) => {
            const angle = (i / usDefs.length) * Math.PI * 2;
            const u = new Soldier({
                x: 850 + Math.cos(angle) * 20,
                y: 150 + Math.sin(angle) * 20,
                team: 'US', ...def
            });
            us.addUnit(u);
            this.allUnits.push(u);
        });
        this.squads.push(us);
        
        this.selectedUnits = [ru.leader];
    },
    
    // ---------- MAP ----------
    generateMap(type) {
        this.obstacles = [];
        this.decorations = [];
        
        if (type === 'open') {
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                const d = 100 + Math.random() * 50;
                this.obstacles.push({ type: 'wall', x: WORLD.width / 2 + Math.cos(a) * d, y: WORLD.height / 2 + Math.sin(a) * d, w: 30 + Math.random() * 20, h: 10 });
            }
            this.obstacles.push({ type: 'house', x: 300, y: 300, w: 60, h: 60 });
            this.obstacles.push({ type: 'house', x: 700, y: 700, w: 60, h: 60 });
        } else if (type === 'forest') {
            for (let i = 0; i < 70; i++) {
                this.obstacles.push({ type: 'tree', x: 100 + Math.random() * 800, y: 100 + Math.random() * 800, w: 12 + Math.random() * 8, h: 12 + Math.random() * 8 });
            }
            for (let i = 0; i < 40; i++) {
                this.decorations.push({ type: 'bush', x: 100 + Math.random() * 800, y: 100 + Math.random() * 800, r: 8 + Math.random() * 6 });
            }
        } else if (type === 'city') {
            const buildings = [
                { x: 200, y: 200, w: 80, h: 60 }, { x: 500, y: 150, w: 70, h: 90 },
                { x: 800, y: 250, w: 90, h: 70 }, { x: 250, y: 500, w: 60, h: 100 },
                { x: 750, y: 550, w: 80, h: 80 }, { x: 450, y: 750, w: 70, h: 60 },
                { x: 150, y: 800, w: 100, h: 50 }, { x: 850, y: 800, w: 60, h: 100 }
            ];
            buildings.forEach(b => this.obstacles.push({ type: 'house', ...b }));
            for (let i = 0; i < 8; i++) {
                this.obstacles.push({ type: 'car', x: 100 + Math.random() * 800, y: 100 + Math.random() * 800, w: 25, h: 12 });
            }
            for (let i = 0; i < 10; i++) {
                this.obstacles.push({ type: 'wall', x: 100 + Math.random() * 800, y: 100 + Math.random() * 800, w: 30, h: 10 });
            }
        }
    },
    
    // ---------- AI ----------
    updateAI(dt) {
        for (const squad of this.squads) {
            this.updateSquadAI(squad, dt);
        }
    },
    
    updateSquadAI(squad, dt) {
        const alive = squad.aliveUnits();
        if (alive.length === 0) return;
        
        // Назначить командира, если потерян
        if (!squad.leader || squad.leader.dead) {
            if (!squad.promoteLeader()) return;
            this.showStatus(squad.team === 'RU' ? '🇷🇺 Потерян командир!' : '🇺🇸 Потерян командир!');
        }
        
        const leader = squad.leader;
        if (leader.manualControl) return;
        
        // Обновить память о врагах
        leader.knownEnemies = leader.knownEnemies.filter(e => performance.now() - e.time < TACTICS.radio.enemyMemory * 1000);
        
        // Командир идёт к точке (если нет цели)
        if (!leader.target) {
            if (leader.knownEnemies.length > 0) {
                const nearest = leader.knownEnemies.reduce((a, b) => dist(leader, a) < dist(leader, b) ? a : b);
                leader.moveTarget = { x: nearest.x, y: nearest.y };
            } else if (!leader.holding) {
                leader.moveTarget = { x: this.objective.x, y: this.objective.y };
            }
        }
        
        // Тактика fire/maneuver
        if (squad.team === 'RU') {
            this.updateRUTactics(squad, dt);
        } else {
            this.updateUSTactics(squad, dt);
        }
        
        // Формация — обновить слоты для подчинённых
        this.updateFormation(squad);
    },
    
    updateRUTactics(squad, dt) {
        const fireGroup = squad.aliveInGroup('fire');
        const manGroup = squad.aliveInGroup('maneuver');
        if (fireGroup.length === 0 || manGroup.length === 0) return;
        
        const fireLeader = fireGroup[0];
        const manLeader = manGroup[0];
        const leader = squad.leader;
        
        // Fire-группа
        if (!fireLeader.manualControl && !fireLeader.target) {
            if (!squad._firePos) {
                let fx = this.objective.x + 150, fy = this.objective.y - 150;
                if (pointInAnyObstacle(fx, fy, this.obstacles)) { fx = this.objective.x + 80; fy = this.objective.y - 80; }
                squad._firePos = { x: fx, y: fy };
            }
            if (!fireLeader._reachedFirePos) {
                fireLeader.moveTarget = { ...squad._firePos };
                if (dist(fireLeader, squad._firePos) < 30) {
                    fireLeader._reachedFirePos = true;
                    fireLeader.moveTarget = null;
                    fireLeader.holding = true;
                    squad.phaseTimer = 2.5;
                }
            } else {
                // Подавление
                for (const u of fireGroup) {
                    if (!u.target || dist(u, u.target) > u.weapon.effRange) {
                        u.isSuppressing = true;
                        u.suppressionTargetPos = { x: this.objective.x, y: this.objective.y };
                    }
                }
            }
        }
        
        // Maneuver-группа
        if (!manLeader.manualControl && !manLeader.target) {
            const fireReady = squad._firePos && fireLeader._reachedFirePos && squad.phaseTimer <= 0;
            if (!fireReady) {
                manLeader.holding = true;
            } else {
                manLeader.holding = false;
                if (!squad._manBounds) {
                    squad._manBounds = [
                        { x: this.objective.x - 80, y: this.objective.y + 80 },
                        { x: this.objective.x - 40, y: this.objective.y + 40 },
                        { x: this.objective.x, y: this.objective.y }
                    ];
                    squad._manBoundIndex = 0;
                    manLeader._reachedBound = false;
                }
                if (squad._manBoundIndex >= squad._manBounds.length) {
                    // Штурм — смена ролей
                    this.swapRURoles(squad);
                    return;
                }
                const bound = squad._manBounds[squad._manBoundIndex];
                if (!manLeader._reachedBound) {
                    manLeader.moveTarget = { ...bound };
                    if (dist(manLeader, bound) < 25) {
                        manLeader._reachedBound = true;
                        manLeader.moveTarget = null;
                        squad.phaseTimer = 1.5;
                    }
                } else if (squad.phaseTimer <= 0) {
                    squad._manBoundIndex++;
                    manLeader._reachedBound = false;
                }
            }
        }
    },
    
    swapRURoles(squad) {
        for (const u of squad.units) {
            if (u.dead) continue;
            if (u.groupId === 'fire') u.groupId = 'maneuver';
            else if (u.groupId === 'maneuver') u.groupId = 'fire';
        }
        // Пересобрать группы
        squad.groups = {};
        for (const u of squad.units) {
            if (u.dead) continue;
            if (!squad.groups[u.groupId]) squad.groups[u.groupId] = [];
            squad.groups[u.groupId].push(u);
        }
        // Сбросить флаги
        for (const u of squad.units) {
            u._reachedFirePos = false;
            u._reachedBound = false;
            u.isSuppressing = false;
            u.phaseTimer = 0;
            u.holding = false;
            u.moveTarget = null;
        }
        squad._firePos = null;
        squad._manBounds = null;
        squad._manBoundIndex = 0;
        this.showStatus('🇷🇺 Смена ролей: огонь ↔ маневр');
    },
    
    updateUSTactics(squad, dt) {
        // Определить роли
        if (!squad._usRoles) squad._usRoles = { A: 'fire', B: 'maneuver' };
        
        const roles = squad._usRoles;
        const fireGroupId = roles.A === 'fire' ? 'A' : 'B';
        const manGroupId = roles.A === 'maneuver' ? 'A' : 'B';
        const fireGroup = squad.aliveInGroup(fireGroupId);
        const manGroup = squad.aliveInGroup(manGroupId);
        if (fireGroup.length === 0 || manGroup.length === 0) return;
        
        const fireLeader = fireGroup[0];
        const manLeader = manGroup[0];
        
        // Fire
        if (!fireLeader.manualControl && !fireLeader.target) {
            if (!squad._firePos) {
                const angle = fireGroupId === 'A' ? -Math.PI / 4 : Math.PI / 4;
                let fx = this.objective.x + Math.cos(angle) * 150;
                let fy = this.objective.y + Math.sin(angle) * 150;
                if (pointInAnyObstacle(fx, fy, this.obstacles)) { fx = this.objective.x; fy = this.objective.y; }
                squad._firePos = { x: fx, y: fy };
            }
            if (!fireLeader._reachedFirePos) {
                fireLeader.moveTarget = { ...squad._firePos };
                if (dist(fireLeader, squad._firePos) < 30) {
                    fireLeader._reachedFirePos = true;
                    fireLeader.moveTarget = null;
                    fireLeader.holding = true;
                    squad.phaseTimer = 2.5;
                }
            } else {
                for (const u of fireGroup) {
                    if (!u.target || dist(u, u.target) > u.weapon.effRange) {
                        u.isSuppressing = true;
                        u.suppressionTargetPos = { x: this.objective.x, y: this.objective.y };
                    }
                }
            }
        }
        
        // Maneuver
        if (!manLeader.manualControl && !manLeader.target) {
            const fireReady = squad._firePos && fireLeader._reachedFirePos && squad.phaseTimer <= 0;
            if (!fireReady) {
                manLeader.holding = true;
            } else {
                manLeader.holding = false;
                if (!squad._manBounds) {
                    const angle = manGroupId === 'A' ? -Math.PI / 3 : Math.PI / 3;
                    squad._manBounds = [
                        { x: this.objective.x + Math.cos(angle) * 80, y: this.objective.y + Math.sin(angle) * 80 },
                        { x: this.objective.x + Math.cos(angle) * 40, y: this.objective.y + Math.sin(angle) * 40 },
                        { x: this.objective.x, y: this.objective.y }
                    ];
                    squad._manBoundIndex = 0;
                    manLeader._reachedBound = false;
                }
                if (squad._manBoundIndex >= squad._manBounds.length) {
                    this.swapUSRoles(squad);
                    return;
                }
                const bound = squad._manBounds[squad._manBoundIndex];
                if (!manLeader._reachedBound) {
                    manLeader.moveTarget = { ...bound };
                    if (dist(manLeader, bound) < 25) {
                        manLeader._reachedBound = true;
                        manLeader.moveTarget = null;
                        squad.phaseTimer = 1.5;
                    }
                } else if (squad.phaseTimer <= 0) {
                    squad._manBoundIndex++;
                    manLeader._reachedBound = false;
                }
            }
        }
    },
    
    swapUSRoles(squad) {
        squad._usRoles.A = squad._usRoles.A === 'fire' ? 'maneuver' : 'fire';
        squad._usRoles.B = squad._usRoles.B === 'fire' ? 'maneuver' : 'fire';
        for (const u of squad.units) {
            u._reachedFirePos = false;
            u._reachedBound = false;
            u.isSuppressing = false;
            u.phaseTimer = 0;
            u.holding = false;
            u.moveTarget = null;
        }
        squad._firePos = null;
        squad._manBounds = null;
        squad._manBoundIndex = 0;
        this.showStatus('🇺🇸 Смена ролей: огонь ↔ маневр');
    },
    
    // ---------- ФОРМАЦИЯ (ключевая часть) ----------
    updateFormation(squad) {
        const alive = squad.aliveUnits();
        const leader = squad.leader;
        if (!leader || leader.dead) return;
        
        // Слоты вокруг лидера
        // Исключаем: лидера, лидеров fire/maneuver (они идут по своим целям), тех у кого ручной приказ
        const excluded = new Set([leader]);
        const fl = squad.team === 'RU' ? squad.aliveInGroup('fire')[0] : null;
        const ml = squad.team === 'RU' ? squad.aliveInGroup('maneuver')[0] : null;
        if (fl) excluded.add(fl);
        if (ml) excluded.add(ml);
        
        if (squad.team === 'US') {
            const fId = squad._usRoles ? (squad._usRoles.A === 'fire' ? 'A' : 'B') : 'A';
            const mId = squad._usRoles ? (squad._usRoles.A === 'maneuver' ? 'A' : 'B') : 'B';
            const flUS = squad.aliveInGroup(fId)[0];
            const mlUS = squad.aliveInGroup(mId)[0];
            if (flUS) excluded.add(flUS);
            if (mlUS) excluded.add(mlUS);
        }
        
        const followers = alive.filter(u =>
            !excluded.has(u) &&
            !u.manualControl &&
            !u._hasActiveOrder &&
            !u.isSuppressing &&
            !u.moveTarget
        );
        
        const total = Math.max(1, followers.length);
        followers.forEach((u, i) => {
            const angle = (i / total) * Math.PI * 2 + leader.facing;
            const radius = TACTICS.formationRadius * (i % 2 === 0 ? 1 : TACTICS.formationSpacing);
            u.formationSlot = {
                x: leader.x + Math.cos(angle) * radius,
                y: leader.y + Math.sin(angle) * radius
            };
        });
        
        // Для остальных (тех, кто в бою или с приказом) — слот не нужен
        for (const u of alive) {
            if (followers.includes(u)) continue;
            if (u === leader) continue;
            u.formationSlot = null;
        }
    },
    
    // ---------- UPDATE ----------
    update(dt) {
        if (this.gameOver) return;
        this.gameTime += dt;
        
        // Камера
        const pan = (this.camera.panSpeed / this.camera.zoom) * dt;
        if (this.keys['a'] || this.keys['arrowleft']) this.camera.x -= pan;
        if (this.keys['d'] || this.keys['arrowright']) this.camera.x += pan;
        if (this.keys['w'] || this.keys['arrowup']) this.camera.y -= pan;
        if (this.keys['s'] || this.keys['arrowdown']) this.camera.y += pan;
        this.clampCamera();
        
        // AI
        this.updateAI(dt);
        
        // Юниты
        for (const u of this.allUnits) this.updateUnit(u, dt);
        
        // Коллизии
        this.resolveCollisions();
        
        // Снаряды / взрывы / текст
        this.bullets = this.bullets.filter(b => (b.life -= dt) > 0);
        this.explosions = this.explosions.filter(e => (e.life -= dt) > 0);
        this.damageTexts.forEach(t => { t.y -= 20 * dt; t.life -= dt; });
        this.damageTexts = this.damageTexts.filter(t => t.life > 0);
        
        // Точка
        this.checkObjective(dt);
        
        // Конец игры
        const ruAlive = this.squads.find(s => s.team === 'RU').aliveUnits().length;
        const usAlive = this.squads.find(s => s.team === 'US').aliveUnits().length;
        if (ruAlive === 0) this.endGame('US');
        else if (usAlive === 0) this.endGame('RU');
        
        this.updateUI();
    },
    
    updateUnit(u, dt) {
        if (u.dead) return;
        
        // Таймеры
        if (u.panicTimer > 0) u.panicTimer -= dt;
        if (u.radioJamTimer > 0) u.radioJamTimer -= dt;
        
        // Подавление
        if (u.suppressionLevel > 0) {
            u.suppressionLevel = Math.max(0, u.suppressionLevel - dt * TACTICS.suppressionDecay);
            u.suppressionTimer = Math.max(0, u.suppressionTimer - dt);
        }
        if (u.suppressionLevel > 10 && u.suppressionLevel <= 40 && u.recoveryTimer <= 0) u.recoveryTimer = TACTICS.suppressionRecovery;
        if (u.recoveryTimer > 0) u.recoveryTimer -= dt;
        
        // Мораль
        u.updateMorale(dt, this.allUnits);
        
        // ===== ПРИОРИТЕТЫ =====
        
        // 1. Surrendered
        if (u.moraleState === 'surrendered') {
            u.state = 'surrendered';
            u.moveTarget = null;
            u.holding = false;
            u.target = null;
            u.setStance('stand');
            return;
        }
        
        // 2. Routing
        if (u.moraleState === 'routing') {
            u.suppressionLevel = 0;
            const enemy = u.findEnemy(this.allUnits, this.obstacles, this.mapType);
            if (enemy) {
                const fleeAngle = Math.atan2(u.y - enemy.y, u.x - enemy.x);
                u.setStance('stand');
                u.facing = fleeAngle;
                if (!u._routingCover || Math.hypot(u._routingCover.x - u.x, u._routingCover.y - u.y) < 5) {
                    u._routingCover = nearestCoverPoint(
                        u.x + Math.cos(fleeAngle) * 80,
                        u.y + Math.sin(fleeAngle) * 80,
                        this.obstacles, 80
                    );
                }
                let tx, ty;
                if (u._routingCover) { tx = u._routingCover.x; ty = u._routingCover.y; }
                else {
                    const margin = 50;
                    const dLeft = u.x, dRight = WORLD.width - u.x, dTop = u.y, dBottom = WORLD.height - u.y;
                    if (dRight > dLeft && dRight > dTop && dRight > dBottom) { tx = WORLD.width - margin; ty = u.y; }
                    else if (dLeft > dTop && dLeft > dBottom) { tx = margin; ty = u.y; }
                    else if (dTop > dBottom) { tx = u.x; ty = margin; }
                    else { tx = u.x; ty = WORLD.height - margin; }
                }
                u.state = 'routing';
                u.moveTo(tx, ty, dt, this.obstacles);
            }
            return;
        }
        
        // 3. Panicked
        if (u.moraleState === 'panicked') {
            u.setStance('prone');
            u.state = 'panicked';
            u.target = u.findEnemy(this.allUnits, this.obstacles, this.mapType);
            if (u.target && u.cooldown <= 0 && !u.isReloading && Math.random() < 0.3) {
                u.facing = Math.atan2(u.target.y - u.y, u.target.x - u.x);
                const shot = u.fire(this.allUnits);
                if (shot) this.handleShot(shot);
            }
            if (u.cooldown > 0) u.cooldown -= dt;
            return;
        }
        
        // 4. Подавлен
        if (u.suppressionLevel > 40) {
            u.setStance('prone');
            u.state = 'suppressed';
            u.target = u.findEnemy(this.allUnits, this.obstacles, this.mapType);
            if (!u._coverTarget || dist(u, u._coverTarget) < 3) {
                u._coverTarget = nearestCoverPoint(u.x, u.y, this.obstacles, 20);
            }
            if (u._coverTarget) u.moveTo(u._coverTarget.x, u._coverTarget.y, dt * 0.5, this.obstacles);
            if (u.target && u.cooldown <= 0 && !u.isReloading && Math.random() < 0.5) {
                u.facing = Math.atan2(u.target.y - u.y, u.target.x - u.x);
                const shot = u.fire(this.allUnits);
                if (shot) this.handleShot(shot);
            }
            if (u.cooldown > 0) u.cooldown -= dt;
            return;
        }
        
        // 5. Перезарядка
        if (u.isReloading) {
            const speedMult = u.suppressionLevel > 40 ? 0.5 : 1.0;
            u.reloadTimer -= dt * speedMult;
            if (u.reloadTimer <= 0) u.isReloading = false;
            return;
        }
        
        // 6. Отложенный приказ (радио)
        if (u.pendingOrder && (u.role === 'commander' || u.role === 'squad_leader')) {
            u.pendingOrder.time -= dt;
            if (u.pendingOrder.time <= 0) {
                if (u.pendingOrder.type === 'move') {
                    u.moveTarget = { x: u.pendingOrder.x, y: u.pendingOrder.y };
                    u.facing = Math.atan2(u.pendingOrder.y - u.y, u.pendingOrder.x - u.x);
                }
                u.pendingOrder = null;
            }
        }
        
        // 7. Подавление огнём (подавляющий)
        if (u.isSuppressing && u.suppressionTargetPos) {
            u.setStance('prone');
            u.facing = Math.atan2(u.suppressionTargetPos.y - u.y, u.suppressionTargetPos.x - u.x);
            if (u.cooldown <= 0 && !u.isReloading) {
                const shot = u.fireSuppression(this.allUnits);
                if (shot) {
                    this.bullets.push({ ...shot, life: 0.15, color: u.team === 'RU' ? '#ffdd55' : '#66ddff', isMG: true });
                }
            }
            if (u.cooldown > 0) u.cooldown -= dt;
            return;
        }
        
        // 8. Поиск цели
        u.target = u.findEnemy(this.allUnits, this.obstacles, this.mapType);
        if (u.target && !u._reportedTarget) {
            u.report('enemy_spotted', { x: u.target.x, y: u.target.y });
            u._reportedTarget = true;
        }
        
        // 9. Прицеливание
        const moving = Math.hypot(u.x - u._lastX, u.y - u._lastY) > 0.05;
        u._lastX = u.x; u._lastY = u.y;
        const canAim = u.target && !moving && u.state !== 'moving' && u.suppressionLevel <= 40 && !u.isReloading && u.stance === u.desiredStance;
        if (canAim) u.aimTimer = Math.min(TACTICS.aimTime, u.aimTimer + dt);
        else u.aimTimer = Math.max(0, u.aimTimer - dt * 3);
        const aimT = u.aimTimer / TACTICS.aimTime;
        u.aimLevel = aimT * aimT * (3 - 2 * aimT);
        
        // 10. Стойка
        u.autoSelectStance();
        if (u.stance !== u.desiredStance) {
            u.stanceTimer -= dt;
            if (u.stanceTimer <= 0) u.stance = u.desiredStance;
        }
        
        // 11. Таймеры
        if (u.cooldown > 0) u.cooldown -= dt;
        if (u.muzzleFlash > 0) u.muzzleFlash -= dt;
        
        // ===== ДВИЖЕНИЕ И СТРЕЛЬБА =====
        
        // Приоритет 1: ручной приказ
        if (u.moveTarget) {
            u.state = 'moving';
            const reached = u.moveTo(u.moveTarget.x, u.moveTarget.y, dt, this.obstacles);
            if (reached || pointInAnyObstacle(u.moveTarget.x, u.moveTarget.y, this.obstacles)) {
                u.moveTarget = null;
                u._hasActiveOrder = false;
            }
            return;
        }
        
        // Приоритет 2: цель в зоне поражения — стреляем
        if (u.target && dist(u, u.target) <= u.weapon.maxRange) {
            u.state = 'attacking';
            u.facing = Math.atan2(u.target.y - u.y, u.target.x - u.x);
            if (dist(u, u.target) <= u.weapon.effRange) {
                if (u.cooldown <= 0) {
                    const shot = u.fire(this.allUnits);
                    if (shot) this.handleShot(shot);
                }
            } else if (!u.holding) {
                u.moveTo(u.target.x, u.target.y, dt, this.obstacles);
            }
            return;
        }
        
        // Приоритет 3: держит позицию
        if (u.holding) {
            u.state = 'holding';
            return;
        }
        
        // Приоритет 4: формация
        if (u.formationSlot) {
            const d = Math.hypot(u.formationSlot.x - u.x, u.formationSlot.y - u.y);
            if (d > 3) {
                u.state = 'moving';
                u.moveTo(u.formationSlot.x, u.formationSlot.y, dt, this.obstacles);
            } else {
                u.state = 'idle';
            }
            return;
        }
        
        // Приоритет 5: idle
        u.state = 'idle';
    },
    
    handleShot(shot) {
        if (shot.type === 'explosion') {
            this.explosions.push({ x: shot.x, y: shot.y, radius: shot.radius, life: 0.5 });
        } else {
            this.bullets.push({
                x: shot.x, y: shot.y, tx: shot.tx, ty: shot.ty,
                color: shot.team === 'RU' ? '#ffdd55' : '#66ddff',
                life: 0.15, team: shot.team, isMG: shot.isMG
            });
        }
    },
    
    resolveCollisions() {
        for (let i = 0; i < this.allUnits.length; i++) {
            const a = this.allUnits[i];
            if (a.dead) continue;
            for (let j = i + 1; j < this.allUnits.length; j++) {
                const b = this.allUnits[j];
                if (b.dead) continue;
                if (a.team === b.team && a.state === 'holding' && b.state === 'holding') continue;
                const dx = b.x - a.x, dy = b.y - a.y;
                const dSq = dx * dx + dy * dy;
                const rA = a.radius * STANCES[a.stance].collision;
                const rB = b.radius * STANCES[b.stance].collision;
                const minD = rA + rB + 1.0;
                if (dSq < minD * minD && dSq > 0.001) {
                    const d = Math.sqrt(dSq);
                    const overlap = (minD - d) * 0.2;
                    const nx = dx / d, ny = dy / d;
                    a.x -= nx * overlap; a.y -= ny * overlap;
                    b.x += nx * overlap; b.y += ny * overlap;
                }
            }
        }
    },
    
    checkObjective(dt) {
        const ru = this.squads.find(s => s.team === 'RU');
        const us = this.squads.find(s => s.team === 'US');
        const ruNear = ru.units.filter(u => !u.dead && u.moraleState !== 'surrendered' && u.moraleState !== 'routing' && dist(u, this.objective) < this.objective.radius).length;
        const usNear = us.units.filter(u => !u.dead && u.moraleState !== 'surrendered' && u.moraleState !== 'routing' && dist(u, this.objective) < this.objective.radius).length;
        
        if (ruNear > 0 && usNear === 0) {
            if (this.objective.owner !== 'RU') {
                this.objective.holdTime += dt;
                if (this.objective.holdTime > TACTICS.captureTime) {
                    this.objective.owner = 'RU';
                    this.objective.holdTime = 0;
                    this.addReport('🇷🇺 Точка захвачена РФ', '#d52b1e');
                }
            }
        } else if (usNear > 0 && ruNear === 0) {
            if (this.objective.owner !== 'US') {
                this.objective.holdTime += dt;
                if (this.objective.holdTime > TACTICS.captureTime) {
                    this.objective.owner = 'US';
                    this.objective.holdTime = 0;
                    this.addReport('🇺🇸 Точка захвачена США', '#3c6eb6');
                }
            }
        } else {
            this.objective.holdTime = Math.max(0, this.objective.holdTime - dt);
        }
    },
    
    endGame(team) {
        this.gameOver = true;
        const el = document.getElementById('game-over');
        const txt = document.getElementById('result-text');
        if (el) el.classList.remove('hidden');
        if (txt) txt.textContent = team === 'RU' ? '🏆 Победа России!' : '🏆 Победа США!';
        this.addReport(team === 'RU' ? 'Победа России!' : 'Победа США!', team === 'RU' ? '#d52b1e' : '#3c6eb6');
    },
    
    // ---------- UI ----------
    showStatus(msg) {
        const el = document.getElementById('status-message');
        if (!el) return;
        el.textContent = msg;
        clearTimeout(this._statusTimer);
        this._statusTimer = setTimeout(() => { el.textContent = ''; }, 2500);
    },
    
    addReport(text, color = '#fff') {
        const log = document.getElementById('reports-log');
        if (!log) return;
        const el = document.createElement('div');
        el.style.color = color;
        const min = Math.floor(this.gameTime / 60).toString().padStart(2, '0');
        const sec = Math.floor(this.gameTime % 60).toString().padStart(2, '0');
        el.textContent = `[${min}:${sec}] ${text}`;
        log.appendChild(el);
        if (log.children.length > 6) log.removeChild(log.firstChild);
        setTimeout(() => el.remove(), 6000);
    },
    
    updateUI() {
        const ru = this.squads.find(s => s.team === 'RU');
        const us = this.squads.find(s => s.team === 'US');
        const ruAlive = ru.aliveUnits().length;
        const usAlive = us.aliveUnits().length;
        document.getElementById('ru-count').textContent = `Живых: ${ruAlive}/${ru.units.length}`;
        document.getElementById('us-count').textContent = `Живых: ${usAlive}/${us.units.length}`;
        const statusText = { neutral: 'нейтральна', RU: '🇷🇺 РФ', US: '🇺🇸 США' }[this.objective.owner];
        document.getElementById('objective-status').textContent = `(${statusText})`;
        const min = Math.floor(this.gameTime / 60).toString().padStart(2, '0');
        const sec = Math.floor(this.gameTime % 60).toString().padStart(2, '0');
        document.getElementById('mission-timer').textContent = `${min}:${sec}`;
        this.updateSelectedUI();
    },
    
    updateSelectedUI() {
        const infoPanel = document.getElementById('weapon-info');
        if (!this.selectedUnits.length) { if (infoPanel) infoPanel.classList.remove('visible'); return; }
        const u = this.selectedUnits[0];
        const w = u.weapon;
        const el = document.getElementById('selected-unit');
        if (el) {
            const aimPct = Math.round(u.aimLevel * 100);
            const moralePct = Math.round(u.morale);
            const moraleIcon = u.moraleState === 'surrendered' ? '🏳️' : u.moraleState === 'routing' ? '🏃' : u.moraleState === 'panicked' ? '😱' : u.moraleState === 'cautious' ? '⚠️' : '';
            const jamIcon = u.radioJamTimer > 0 ? '📵' : '';
            el.innerHTML = `<b>${u.roleName}</b> | HP ${Math.ceil(u.hp)} | ${STANCES[u.stance].name}` +
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
            let ammoStr = `${u.ammo} / ${w.maxAmmo}`;
            if (w.hasGL) ammoStr += ` (ГП: ${u.glAmmo})`;
            document.getElementById('wi-ammo').textContent = ammoStr;
            document.getElementById('wi-range').textContent = `${w.effRange || 0} / ${w.maxRange || 0} м`;
            document.getElementById('wi-rpm').textContent = `${w.rpm || 0} в/м`;
            infoPanel.classList.add('visible');
        }
    },
    
    // ---------- РЕНДЕР ----------
    loop(now) {
        const dt = Math.min(0.05, (now - this._lastTime) / 1000);
        this._lastTime = now;
        this.update(dt);
        this.draw();
        requestAnimationFrame(t => this.loop(t));
    },
    
    draw() {
        const ctx = this.ctx;
        if (this.mapType === 'forest') ctx.fillStyle = '#1e2e1a';
        else if (this.mapType === 'city') ctx.fillStyle = '#2a2a2a';
        else ctx.fillStyle = '#2d3a2e';
        ctx.fillRect(0, 0, this.W, this.H);
        
        ctx.save();
        ctx.translate(this.W / 2, this.H / 2);
        ctx.scale(this.camera.zoom, this.camera.zoom);
        ctx.translate(-this.camera.x, -this.camera.y);
        
        // Поле
        ctx.fillStyle = this.mapType === 'forest' ? '#2a3a24' : this.mapType === 'city' ? '#333' : '#33422f';
        ctx.fillRect(0, 0, WORLD.width, WORLD.height);
        
        // Сетка
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1 / this.camera.zoom;
        for (let x = 0; x <= WORLD.width; x += 100) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.height); ctx.stroke();
        }
        for (let y = 0; y <= WORLD.height; y += 100) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.width, y); ctx.stroke();
        }
        ctx.strokeStyle = '#777';
        ctx.lineWidth = 3 / this.camera.zoom;
        ctx.strokeRect(0, 0, WORLD.width, WORLD.height);
        
        // Точка
        ctx.beginPath();
        ctx.arc(this.objective.x, this.objective.y, this.objective.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.objective.owner === 'RU' ? 'rgba(213,43,30,0.25)' : this.objective.owner === 'US' ? 'rgba(60,110,182,0.25)' : 'rgba(255,215,0,0.15)';
        ctx.fill();
        ctx.strokeStyle = this.objective.owner === 'RU' ? '#d52b1e' : this.objective.owner === 'US' ? '#3c6eb6' : '#ffd700';
        ctx.lineWidth = 2 / this.camera.zoom;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${20 / this.camera.zoom}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('★', this.objective.x, this.objective.y);
        
        if (this.objective.holdTime > 0) {
            const frac = Math.min(1, this.objective.holdTime / TACTICS.captureTime);
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 3 / this.camera.zoom;
            ctx.beginPath();
            ctx.arc(this.objective.x, this.objective.y, this.objective.radius + 8 / this.camera.zoom, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
            ctx.stroke();
        }
        
        // Декор
        this.decorations.forEach(d => {
            if (d.type === 'bush') {
                ctx.fillStyle = '#1f401f';
                ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
            }
        });
        
        // Препятствия
        this.obstacles.forEach(obs => {
            if (obs.type === 'wall') {
                ctx.fillStyle = '#8B7355';
                ctx.fillRect(obs.x - obs.w / 2, obs.y - obs.h / 2, obs.w, obs.h);
                ctx.strokeStyle = '#5a4a35';
                ctx.lineWidth = 2 / this.camera.zoom;
                ctx.strokeRect(obs.x - obs.w / 2, obs.y - obs.h / 2, obs.w, obs.h);
            } else if (obs.type === 'house') {
                ctx.fillStyle = '#5a5a5a';
                ctx.fillRect(obs.x - obs.w / 2, obs.y - obs.h / 2, obs.w, obs.h);
                ctx.strokeStyle = '#222';
                ctx.lineWidth = 2 / this.camera.zoom;
                ctx.strokeRect(obs.x - obs.w / 2, obs.y - obs.h / 2, obs.w, obs.h);
                ctx.fillStyle = '#777';
                ctx.fillRect(obs.x - obs.w / 4, obs.y - obs.h / 4, obs.w / 2, obs.h / 2);
            } else if (obs.type === 'tree') {
                ctx.fillStyle = '#3a2a1a';
                ctx.beginPath(); ctx.arc(obs.x, obs.y, obs.w * 0.4, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#2a5a2a';
                ctx.beginPath(); ctx.arc(obs.x, obs.y, obs.w, 0, Math.PI * 2); ctx.fill();
            } else if (obs.type === 'car') {
                ctx.fillStyle = '#4a6a8a';
                ctx.fillRect(obs.x - obs.w / 2, obs.y - obs.h / 2, obs.w, obs.h);
                ctx.strokeStyle = '#222';
                ctx.lineWidth = 1 / this.camera.zoom;
                ctx.strokeRect(obs.x - obs.w / 2, obs.y - obs.h / 2, obs.w, obs.h);
            }
        });
        
        // Пули
        this.bullets.forEach(b => {
            ctx.strokeStyle = b.color;
            ctx.lineWidth = (b.isMG ? 2 : 1.5) / this.camera.zoom;
            ctx.beginPath();
            ctx.moveTo(b.x, b.y);
            const dx = b.tx - b.x, dy = b.ty - b.y;
            const d = Math.hypot(dx, dy) || 1;
            ctx.lineTo(b.x + (dx / d) * 40, b.y + (dy / d) * 40);
            ctx.stroke();
        });
        
        // Взрывы
        this.explosions.forEach(e => {
            const alpha = e.life / 0.5;
            ctx.fillStyle = `rgba(255, 100, 0, ${alpha * 0.6})`;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.radius * 0.4, 0, Math.PI * 2); ctx.fill();
        });
        
        // Юниты
        this.allUnits.forEach(u => this.drawUnit(u, ctx));
        
        // Текст урона
        this.damageTexts.forEach(t => {
            ctx.fillStyle = t.color;
            ctx.font = `bold ${14 / this.camera.zoom}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.globalAlpha = t.life;
            ctx.fillText(t.text, t.x, t.y);
            ctx.globalAlpha = 1;
        });
        
        // Курсор
        if (this.mouse.x && !this.isTouch) {
            const wp = this.screenToWorld(this.mouse.x, this.mouse.y);
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1 / this.camera.zoom;
            ctx.beginPath(); ctx.arc(wp.x, wp.y, 8 / this.camera.zoom, 0, Math.PI * 2); ctx.stroke();
        }
        
        ctx.restore();
        this.drawMinimap();
    },
    
    drawUnit(u, ctx) {
        if (u.dead) {
            const alpha = Math.max(0.2, 1 - (performance.now() - u.deathTime) / 60000);
            ctx.fillStyle = `rgba(60, 40, 40, ${alpha})`;
            ctx.save();
            ctx.translate(u.x, u.y);
            ctx.rotate(u.facing + Math.PI / 2);
            ctx.beginPath();
            ctx.ellipse(0, 0, u.radius * 1.8, u.radius * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }
        
        const baseColor = u.team === 'RU' ? '#d52b1e' : '#3c6eb6';
        const isCommander = u.role === 'commander' || u.role === 'squad_leader';
        const isSelected = this.selectedUnits.includes(u);
        const mod = STANCES[u.stance];
        const vr = u.radius * Math.sqrt(mod.targetSize);
        
        if (u.manualControl) {
            ctx.setLineDash([4 / this.camera.zoom, 4 / this.camera.zoom]);
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2 / this.camera.zoom;
            ctx.beginPath(); ctx.arc(u.x, u.y, vr + 6, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
        }
        if (u.suppressionLevel > 10) {
            const a = 0.2 + (u.suppressionLevel / 100) * 0.6;
            ctx.fillStyle = `rgba(180, 60, 255, ${a})`;
            ctx.beginPath(); ctx.arc(u.x, u.y, vr + 6, 0, Math.PI * 2); ctx.fill();
        }
        if (isSelected) {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 1.5 / this.camera.zoom;
            ctx.beginPath(); ctx.arc(u.x, u.y, vr + 4, 0, Math.PI * 2); ctx.stroke();
        }
        
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(u.x + 1.5, u.y + 1.5, vr, vr * 0.7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = baseColor;
        
        if (u.stance === 'prone') {
            ctx.save();
            ctx.translate(u.x, u.y);
            ctx.rotate(u.facing);
            ctx.beginPath(); ctx.ellipse(0, 0, vr * 1.6, vr * 0.8, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else if (u.stance === 'crouch') {
            ctx.beginPath(); ctx.arc(u.x, u.y, vr * 0.9, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.beginPath(); ctx.arc(u.x, u.y, vr, 0, Math.PI * 2); ctx.fill();
        }
        
        if (isCommander) {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 1.2 / this.camera.zoom;
            ctx.beginPath(); ctx.arc(u.x, u.y, vr, 0, Math.PI * 2); ctx.stroke();
        }
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = (u.stance === 'prone' ? 1.5 : 1.2) / this.camera.zoom;
        ctx.beginPath();
        ctx.moveTo(u.x, u.y);
        ctx.lineTo(u.x + Math.cos(u.facing) * (vr + 3), u.y + Math.sin(u.facing) * (vr + 3));
        ctx.stroke();
        
        if (u.muzzleFlash > 0) {
            ctx.fillStyle = '#ffaa00';
            const fx = u.x + Math.cos(u.facing) * (vr + 2);
            const fy = u.y + Math.sin(u.facing) * (vr + 2);
            ctx.beginPath(); ctx.arc(fx, fy, u.stance === 'prone' ? 3.5 : 2.5, 0, Math.PI * 2); ctx.fill();
        }
        
        const hpFrac = u.hp / u.maxHp;
        const bw = 12 / this.camera.zoom, bh = 2 / this.camera.zoom;
        if (hpFrac < 1) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(u.x - bw / 2, u.y - vr - 6 / this.camera.zoom, bw, bh);
            ctx.fillStyle = hpFrac > 0.5 ? '#3c3' : hpFrac > 0.25 ? '#fc3' : '#f33';
            ctx.fillRect(u.x - bw / 2, u.y - vr - 6 / this.camera.zoom, bw * hpFrac, bh);
        }
        
        if (u.morale < 100) {
            const mc = u.morale > 70 ? '#3c3' : u.morale > 40 ? '#fc3' : u.morale > 20 ? '#f93' : '#f33';
            const my = u.y - vr - 10 / this.camera.zoom;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(u.x - bw / 2, my, bw, bh);
            ctx.fillStyle = mc;
            ctx.fillRect(u.x - bw / 2, my, bw * (u.morale / 100), bh);
        }
        
        if (u.isReloading) {
            const prog = 1 - (u.reloadTimer / u.weapon.reloadTime);
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2 / this.camera.zoom;
            ctx.beginPath();
            ctx.arc(u.x, u.y, vr + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog);
            ctx.stroke();
        }
        
        if (u.radioJamTimer > 0) {
            ctx.fillStyle = '#ff4444';
            ctx.font = `bold ${12 / this.camera.zoom}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('📵', u.x, u.y - vr - 18 / this.camera.zoom);
        }
        
        if (u.moraleState !== 'normal') {
            const icons = { cautious: '⚠️', panicked: '😱', routing: '🏃', surrendered: '🏳️' };
            ctx.font = `bold ${12 / this.camera.zoom}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(icons[u.moraleState] || '', u.x, u.y - vr - 28 / this.camera.zoom);
        }
    },
    
    drawMinimap() {
        const mw = this.minimap.width, mh = this.minimap.height;
        const mctx = this.mctx;
        mctx.fillStyle = '#1a2418';
        mctx.fillRect(0, 0, mw, mh);
        
        const sx = mw / WORLD.width, sy = mh / WORLD.height;
        
        this.obstacles.forEach(obs => {
            mctx.fillStyle = obs.type === 'house' ? '#555' : obs.type === 'tree' ? '#2a4a2a' : obs.type === 'car' ? '#446' : '#7a6545';
            mctx.fillRect((obs.x - obs.w / 2) * sx, (obs.y - obs.h / 2) * sy, obs.w * sx, obs.h * sy);
        });
        
        mctx.beginPath();
        mctx.arc(this.objective.x * sx, this.objective.y * sy, 8, 0, Math.PI * 2);
        mctx.fillStyle = this.objective.owner === 'RU' ? 'rgba(213,43,30,0.5)' : this.objective.owner === 'US' ? 'rgba(60,110,182,0.5)' : 'rgba(255,215,0,0.3)';
        mctx.fill();
        mctx.strokeStyle = this.objective.owner === 'RU' ? '#d52b1e' : this.objective.owner === 'US' ? '#3c6eb6' : '#ffd700';
        mctx.lineWidth = 1.5;
        mctx.stroke();
        
        this.allUnits.forEach(u => {
            if (u.dead) return;
            mctx.fillStyle = u.team === 'RU' ? '#d52b1e' : '#3c6eb6';
            mctx.beginPath();
            mctx.arc(u.x * sx, u.y * sy, 2, 0, Math.PI * 2);
            mctx.fill();
        });
        
        const halfW = (this.W / 2) / this.camera.zoom;
        const halfH = (this.H / 2) / this.camera.zoom;
        mctx.strokeStyle = 'rgba(255,255,255,0.8)';
        mctx.lineWidth = 1;
        mctx.strokeRect((this.camera.x - halfW) * sx, (this.camera.y - halfH) * sy, halfW * 2 * sx, halfH * 2 * sy);
    },
    
    // ---------- КАМЕРА ----------
    screenToWorld(sx, sy) {
        return {
            x: (sx - this.W / 2) / this.camera.zoom + this.camera.x,
            y: (sy - this.H / 2) / this.camera.zoom + this.camera.y
        };
    },
    worldToScreen(wx, wy) {
        return {
            x: (wx - this.camera.x) * this.camera.zoom + this.W / 2,
            y: (wy - this.camera.y) * this.camera.zoom + this.H / 2
        };
    },
    clampCamera() {
        if (!this.W || !this.H) return;
        const halfW = (this.W / 2) / this.camera.zoom;
        const halfH = (this.H / 2) / this.camera.zoom;
        if (WORLD.width * this.camera.zoom < this.W) this.camera.x = WORLD.width / 2;
        else this.camera.x = Math.max(halfW, Math.min(WORLD.width - halfW, this.camera.x));
        if (WORLD.height * this.camera.zoom < this.H) this.camera.y = WORLD.height / 2;
        else this.camera.y = Math.max(halfH, Math.min(WORLD.height - halfH, this.camera.y));
    },
    zoomAt(sx, sy, factor) {
        const before = this.screenToWorld(sx, sy);
        this.camera.zoom = Math.max(this.camera.minZoom, Math.min(this.camera.maxZoom, this.camera.zoom * factor));
        const after = this.screenToWorld(sx, sy);
        this.camera.x += before.x - after.x;
        this.camera.y += before.y - after.y;
        this.clampCamera();
    },
    
    // ---------- ВВОД ----------
    setupInput() {
        const c = this.canvas;
        c.addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
        c.addEventListener('mousedown', e => {
            if (this.gameOver) return;
            const wp = this.screenToWorld(e.clientX, e.clientY);
            if (e.button === 0) this.handleLeftClick(wp.x, wp.y);
            else if (e.button === 2) this.executeOrder(wp.x, wp.y);
        });
        c.addEventListener('contextmenu', e => e.preventDefault());
        c.addEventListener('wheel', e => {
            e.preventDefault();
            this.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
        }, { passive: false });
        
        document.addEventListener('keydown', e => {
            this.keys[e.key.toLowerCase()] = true;
            if (e.key === 'Escape') { this.selectedUnits = [this.squads[0].leader]; this.updateSelectedUI(); }
            if (e.key === '1') this.setStance('stand');
            if (e.key === '2') this.setStance('crouch');
            if (e.key === '3') this.setStance('prone');
            if (e.key.toLowerCase() === 'r') {
                this.selectedUnits.forEach(u => {
                    if (u.dead || u.isReloading) return;
                    if (u.ammo < u.weapon.maxAmmo) {
                        u.isReloading = true;
                        u.reloadTimer = u.weapon.reloadTime;
                        u.aimTimer = 0;
                    }
                });
                this.showStatus('Перезарядка');
            }
        });
        document.addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
    },
    
    handleLeftClick(wx, wy) {
        // Выбор юнита
        for (const u of this.allUnits) {
            if (u.dead || u.team !== 'RU') continue;
            if (Math.hypot(u.x - wx, u.y - wy) < u.radius + 6 / this.camera.zoom) {
                this.selectedUnits = [u];
                this.updateSelectedUI();
                return;
            }
        }
        // Атака по врагу
        for (const u of this.allUnits) {
            if (u.dead || u.team !== 'US') continue;
            if (Math.hypot(u.x - wx, u.y - wy) < u.radius + 8 / this.camera.zoom) {
                this.selectedUnits.forEach(s => {
                    s.moveTarget = { x: u.x, y: u.y };
                    s._hasActiveOrder = true;
                });
                this.showStatus(`Атака: ${u.roleName}`);
                return;
            }
        }
        // Приказ
        this.executeOrder(wx, wy);
    },
    
    executeOrder(wx, wy) {
        if (this.globalAIMode) { this.showStatus('Сначала перехватите управление'); return; }
        const controllable = this.selectedUnits.filter(u => u.manualControl && !u.dead);
        if (controllable.length === 0) { this.showStatus('Нет солдат под управлением'); return; }
        
        const commander = this.squads
            .flatMap(s => s.units)
            .find(u => (u.role === 'commander' || u.role === 'squad_leader') && !u.dead && u.manualControl);
        
        if (this.orderMode === 'move') {
            if (commander) {
                commander.pendingOrder = { type: 'move', x: wx, y: wy, time: TACTICS.radio.orderDelay };
                this.showStatus('Приказ передан (2 с)...');
            } else {
                controllable.forEach(u => { u.moveTarget = { x: wx, y: wy }; u._hasActiveOrder = true; });
            }
        } else if (this.orderMode === 'attack') {
            controllable.forEach(u => { u.moveTarget = { x: wx, y: wy }; u._hasActiveOrder = true; });
            this.showStatus('Атака');
        } else if (this.orderMode === 'hold') {
            controllable.forEach(u => { u.moveTarget = null; u.holding = true; u.formationSlot = null; });
            this.showStatus('Держать позицию');
        } else if (this.orderMode === 'follow') {
            controllable.forEach(u => { u.followTarget = commander; });
            this.showStatus('Следовать за командиром');
        }
    },
    
    setOrderMode(mode) {
        this.orderMode = mode;
        document.querySelectorAll('#orders button').forEach(b => b.classList.remove('active'));
        const map = { move: 'btn-move', attack: 'btn-attack', hold: 'btn-hold', follow: 'btn-follow' };
        const btn = document.getElementById(map[mode]);
        if (btn) btn.classList.add('active');
    },
    
    setStance(stance) {
        this.selectedUnits.forEach(u => {
            if (u.dead) return;
            u.stanceLocked = true;
            u.setStance(stance);
        });
        this.showStatus(STANCES[stance].name);
    },
    
    toggleAIMode() {
        const btn = document.getElementById('btn-ai-mode');
        if (this.globalAIMode) {
            const alive = this.selectedUnits.filter(u => !u.dead);
            if (alive.length === 0) { this.showStatus('Выберите живого'); return; }
            const isCmd = alive.some(u => u.role === 'commander');
            if (isCmd) {
                this.squads.find(s => s.team === 'RU').units.forEach(u => { if (!u.dead) u.manualControl = true; });
                this.showStatus('Ручное управление отделением');
            } else {
                alive.forEach(u => u.manualControl = true);
                this.showStatus(`Ручное: ${alive[0].roleName}`);
            }
            this.globalAIMode = false;
            if (btn) { btn.textContent = 'ИИ: ВЫКЛ'; btn.style.background = '#6a3a3a'; }
        } else {
            this.squads.find(s => s.team === 'RU').units.forEach(u => {
                u.manualControl = false;
                u.moveTarget = null;
                u.formationSlot = null;
                u.holding = false;
                u._hasActiveOrder = false;
            });
            this.globalAIMode = true;
            if (btn) { btn.textContent = 'ИИ: ВКЛ'; btn.style.background = '#4a3a6a'; }
            this.showStatus('Управление ИИ');
        }
    }
};
