// ==================== GAME.JS ====================

class BulletPool {
    constructor(size = 300) { this.pool = new Array(size); for (let i = 0; i < size; i++) this.pool[i] = {}; this.active = []; }
    spawn(props) { const b = this.pool.pop() || {}; Object.assign(b, props); this.active.push(b); return b; }
    update(dt) {
        const a = this.active;
        for (let i = a.length - 1; i >= 0; i--) {
            const b = a[i]; b.life -= dt;
            if (b.life <= 0) { a[i] = a[a.length - 1]; a.pop(); this.pool.push(b); }
        }
    }
}

const GAME = {
    canvas: null, ctx: null, minimap: null, mctx: null, W: 0, H: 0,
    obstacles: [], decorations: [], bullets: new BulletPool(300), explosions: [], damageTexts: [],
    grenades: [], smokes: [], squads: [], allUnits: [], vehicles: [], selectedUnits: [],
    objective: { x: WORLD.width / 2, y: WORLD.height / 2, radius: TACTICS.objectiveRadius, owner: 'neutral', holdTime: 0 },
    mapType: 'open', gameTime: 0, gameOver: false, orderMode: 'move', globalAIMode: true,
    mouse: { x: 0, y: 0 }, keys: {}, isTouch: false, _lastTime: 0, _initialized: false,
    _spatialHash: new SpatialHash(50), _statusTimer: 0, _screenShake: { x: 0, y: 0, time: 0 },
    
    init(canvas, minimap) {
        if (this._initialized) return;
        this._initialized = true;
        this.canvas = canvas; this.ctx = canvas.getContext('2d');
        this.minimap = minimap; this.mctx = minimap.getContext('2d');
        minimap.width = 180; minimap.height = 180;
        this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.setupInput();
    },
    
    resize() { if (!this.canvas) return; this.W = this.canvas.width = window.innerWidth; this.H = this.canvas.height = window.innerHeight; Camera.clamp(this.W, this.H); },
    
    start(mapType) {
        try {
            this.mapType = mapType; this.generateMap(mapType);
            this.gameTime = 0; this.gameOver = false;
            this.bullets = new BulletPool(300); this.explosions = []; this.damageTexts = [];
            this.grenades = []; this.smokes = []; this.squads = []; this.allUnits = []; this.vehicles = [];
            this.selectedUnits = [];
            this.objective = { x: WORLD.width / 2, y: WORLD.height / 2, radius: TACTICS.objectiveRadius, owner: 'neutral', holdTime: 0 };
            this.globalAIMode = true; this._screenShake = { x: 0, y: 0, time: 0 };
            
            const gameOverEl = document.getElementById('game-over');
            if (gameOverEl) gameOverEl.classList.add('hidden');
            
            this.createSquads();
            
            if (typeof Weather !== 'undefined') {
                const weathers = ['clear', 'rain', 'fog', 'snow'];
                const w = weathers[Math.floor(Math.random() * weathers.length)];
                Weather.set(w, 0.5);
            }
            
            Camera.zoom = Math.max(Camera.minZoom, Math.min(Camera.maxZoom, Math.min(this.W / WORLD.width, this.H / WORLD.height) * 0.95));
            Camera.x = WORLD.width / 2; Camera.y = WORLD.height / 2;
            Camera.clamp(this.W, this.H);
            
            const aiBtn = document.getElementById('btn-ai-mode');
            if (aiBtn) { aiBtn.textContent = 'ИИ: ВКЛ'; aiBtn.style.background = '#4a3a6a'; }
            this.setOrderMode('move');
            
            this._lastTime = performance.now();
            requestAnimationFrame(t => this.loop(t));
        } catch (e) {
            console.error('Ошибка старта игры:', e);
            alert('Ошибка старта: ' + e.message);
        }
    },
    
    createSquads() {
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
            const u = new Soldier({ x: 150 + Math.cos(angle) * 20, y: 850 + Math.sin(angle) * 20, team: 'RU', ...def });
            ru.addUnit(u); this.allUnits.push(u);
        });
        this.squads.push(ru);
        
        const ruVehicle = new Vehicle({ x: 150, y: 880, team: 'RU', type: 'bmp2', name: 'БМП-2' });
        ruVehicle.driver = ru.units.find(u => u.role === 'bmp_driver');
        ruVehicle.gunner = ru.units.find(u => u.role === 'bmp_gunner');
        let loaded = 0;
        ru.units.forEach(u => {
            if (u !== ruVehicle.driver && u !== ruVehicle.gunner) {
                if (loaded < 7) { ruVehicle.loadPassenger(u); loaded++; }
                else { u.x = 150 + Math.cos(Math.random() * Math.PI * 2) * 30; u.y = 880 + Math.sin(Math.random() * Math.PI * 2) * 30; }
            }
        });
        this.vehicles.push(ruVehicle);
        
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
            const u = new Soldier({ x: 850 + Math.cos(angle) * 20, y: 150 + Math.sin(angle) * 20, team: 'US', ...def });
            us.addUnit(u); this.allUnits.push(u);
        });
        this.squads.push(us);
        
        const usVehicle = new Vehicle({ x: 850, y: 120, team: 'US', type: 'bradley', name: 'M2 Bradley' });
        usVehicle.driver = us.units.find(u => u.role === 'rifleman'); 
        usVehicle.gunner = us.units.find(u => u.role === 'mg');
        let loadedUS = 0;
        us.units.forEach(u => {
            if (u !== usVehicle.driver && u !== usVehicle.gunner && u.role !== 'squad_leader') {
                if (loadedUS < 6) { usVehicle.loadPassenger(u); loadedUS++; }
                else { u.x = 850 + Math.cos(Math.random() * Math.PI * 2) * 30; u.y = 120 + Math.sin(Math.random() * Math.PI * 2) * 30; }
            }
        });
        this.vehicles.push(usVehicle);
        
        this.selectedUnits = [ru.leader];
    },
    
    generateMap(type) {
        this.obstacles = []; this.decorations = [];
        if (type === 'open') {
            for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, d = 100 + Math.random() * 50; this.obstacles.push({ type: 'wall', x: WORLD.width / 2 + Math.cos(a) * d, y: WORLD.height / 2 + Math.sin(a) * d, w: 30 + Math.random() * 20, h: 10 }); }
            this.obstacles.push({ type: 'house', x: 300, y: 300, w: 60, h: 60 }, { type: 'house', x: 700, y: 700, w: 60, h: 60 });
        } else if (type === 'forest') {
            for (let i = 0; i < 70; i++) this.obstacles.push({ type: 'tree', x: 100 + Math.random() * 800, y: 100 + Math.random() * 800, w: 12 + Math.random() * 8, h: 12 + Math.random() * 8 });
            for (let i = 0; i < 40; i++) this.decorations.push({ type: 'bush', x: 100 + Math.random() * 800, y: 100 + Math.random() * 800, r: 8 + Math.random() * 6 });
        } else if (type === 'city') {
            const buildings = [{ x: 200, y: 200, w: 80, h: 60 }, { x: 500, y: 150, w: 70, h: 90 }, { x: 800, y: 250, w: 90, h: 70 }, { x: 250, y: 500, w: 60, h: 100 }, { x: 750, y: 550, w: 80, h: 80 }, { x: 450, y: 750, w: 70, h: 60 }, { x: 150, y: 800, w: 100, h: 50 }, { x: 850, y: 800, w: 60, h: 100 }];
            buildings.forEach(b => this.obstacles.push({ type: 'house', ...b }));
            for (let i = 0; i < 8; i++) this.obstacles.push({ type: 'car', x: 100 + Math.random() * 800, y: 100 + Math.random() * 800, w: 25, h: 12 });
            for (let i = 0; i < 10; i++) this.obstacles.push({ type: 'wall', x: 100 + Math.random() * 800, y: 100 + Math.random() * 800, w: 30, h: 10 });
        }
    },
    
    update(dt) {
        if (this.gameOver) return;
        this.gameTime += dt;
        
        const pan = (Camera.panSpeed / Camera.zoom) * dt;
        if (this.keys['a'] || this.keys['arrowleft']) Camera.x -= pan;
        if (this.keys['d'] || this.keys['arrowright']) Camera.x += pan;
        if (this.keys['w'] || this.keys['arrowup']) Camera.y -= pan;
        if (this.keys['s'] || this.keys['arrowdown']) Camera.y += pan;
        Camera.clamp(this.W, this.H);
        
        this._spatialHash.clear();
        for (let i = 0; i < this.allUnits.length; i++) {
            const u = this.allUnits[i];
            if (!u.dead) this._spatialHash.insert(u);
        }
        
        AI.updateAll(this, dt);
        for (let i = 0; i < this.allUnits.length; i++) AI.updateUnit(this, this.allUnits[i], dt);
        for (let i = 0; i < this.vehicles.length; i++) this.vehicles[i].update(dt);
        
        this.resolveCollisions();
        this.bullets.update(dt);
        
        for (let i = this.grenades.length - 1; i >= 0; i--) {
            const g = this.grenades[i];
            g.progress += dt / g.duration;
            if (g.progress < 1) { g.x = g.x + (g.tx - g.x) * 0.15; g.y = g.y + (g.ty - g.y) * 0.15; }
            else {
                g.x = g.tx; g.y = g.ty; g.fuse -= dt;
                if (g.fuse <= 0) {
                    if (g.grenadeType === 'frag') {
                        const r = TACTICS.grenade.blastRadius;
                        for (const u of this.allUnits) {
                            if (u.dead || u.team === g.thrower.team || u.inVehicle) continue;
                            const d = Math.hypot(u.x - g.x, u.y - g.y);
                            if (d < r) {
                                const falloff = 1 - d / r, dmg = TACTICS.grenade.damage * falloff;
                                const result = u.health.takeDamage(dmg); u._showDamage(dmg, result.part);
                                if (result.died || u.health.dead) { u.hp = 0; u.dead = true; u.deathTime = performance.now(); g.thrower._notifyDeath(u, this.allUnits); }
                            }
                            if (d < r * 2) u.applySuppression((1 - d / (r * 2)) * TACTICS.grenade.suppressionPower);
                        }
                        this.explosions.push({ x: g.x, y: g.y, radius: r, life: 0.5 });
                        if (typeof Audio !== 'undefined') Audio.explosion();
                        this._screenShake = { x: 0, y: 0, time: 0.5 };
                    } else if (g.grenadeType === 'smoke') {
                        this.smokes.push({ x: g.x, y: g.y, radius: 2, maxRadius: 8, duration: 10, life: 10 });
                        if (typeof Audio !== 'undefined') Audio.explosion();
                    }
                    this.grenades.splice(i, 1); continue;
                }
            }
        }
        
        for (let i = this.smokes.length - 1; i >= 0; i--) {
            const s = this.smokes[i]; s.life -= dt; s.radius = Math.min(s.maxRadius, s.radius + dt * 4);
            if (s.life <= 0) this.smokes.splice(i, 1);
        }
        
        const ex = this.explosions;
        for (let i = ex.length - 1; i >= 0; i--) { ex[i].life -= dt; if (ex[i].life <= 0) { ex[i] = ex[ex.length - 1]; ex.pop(); } }
        
        const dts = this.damageTexts;
        for (let i = dts.length - 1; i >= 0; i--) { dts[i].y -= 20 * dt; dts[i].life -= dt; if (dts[i].life <= 0) { dts[i] = dts[dts.length - 1]; dts.pop(); } }
        
        if (this._screenShake.time > 0) {
            this._screenShake.time -= dt;
            this._screenShake.x = (Math.random() - 0.5) * 4; this._screenShake.y = (Math.random() - 0.5) * 4;
        } else { this._screenShake.x = 0; this._screenShake.y = 0; }
        
        if (typeof Weather !== 'undefined') Weather.update(dt);
        
        this.checkObjective(dt);
        
        const ruSquad = this.squads.find(s => s.team === 'RU'), usSquad = this.squads.find(s => s.team === 'US');
        if (ruSquad && usSquad) {
            if (ruSquad.aliveUnits().length === 0) this.endGame('US');
            else if (usSquad.aliveUnits().length === 0) this.endGame('RU');
        }
        
        this.updateUI();
    },
    
    handleShot(shot) {
        if (!shot) return;
        if (shot.type === 'explosion') {
            this.explosions.push({ x: shot.x, y: shot.y, radius: shot.radius, life: 0.5 });
            if (typeof Audio !== 'undefined') Audio.explosion();
            this._screenShake = { x: 0, y: 0, time: 0.3 };
        } else if (shot.type === 'grenade') {
            this.grenades.push({ x: shot.x, y: shot.y, tx: shot.tx, ty: shot.ty, progress: 0, duration: 0.5, fuse: shot.fuse, grenadeType: shot.grenadeType, thrower: shot.thrower });
        } else if (shot.type === 'melee') {
            if (shot.hit) { this.damageTexts.push({ x: shot.tx, y: shot.ty - 10, text: '🔪', life: 0.5, color: '#fff' }); if (typeof Audio !== 'undefined') Audio.hit(); }
        } else {
            this.bullets.spawn({ x: shot.x, y: shot.y, tx: shot.tx, ty: shot.ty, color: shot.team === 'RU' ? '#ffdd55' : '#66ddff', life: 0.15, team: shot.team, isMG: shot.isMG });
            if (typeof Audio !== 'undefined') Audio.shot('ak74m');
        }
    },
    
    resolveCollisions() {
        const units = this.allUnits;
        for (let i = 0; i < units.length; i++) {
            const a = units[i]; if (a.dead || a.inVehicle) continue;
            for (let j = i + 1; j < units.length; j++) {
                const b = units[j]; if (b.dead || b.inVehicle) continue;
                if (a.team === b.team && a.state === 'holding' && b.state === 'holding') continue;
                const dx = b.x - a.x, dy = b.y - a.y, dSq = dx * dx + dy * dy;
                const rA = a.radius * STANCES[a.stance].collision, rB = b.radius * STANCES[b.stance].collision, minD = rA + rB + 1.0;
                if (dSq < minD * minD && dSq > 0.001) {
                    const d = Math.sqrt(dSq), overlap = (minD - d) * 0.2, nx = dx / d, ny = dy / d;
                    a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
                }
            }
        }
    },
    
    checkObjective(dt) {
        const ru = this.squads.find(s => s.team === 'RU'), us = this.squads.find(s => s.team === 'US');
        if (!ru || !us) return;
        const obj = this.objective, r = obj.radius;
        let ruNear = 0, usNear = 0;
        for (const u of ru.units) { if (!u.dead && u.moraleState !== 'surrendered' && u.moraleState !== 'routing' && !u.inVehicle && dist(u, obj) < r) ruNear++; }
        for (const u of us.units) { if (!u.dead && u.moraleState !== 'surrendered' && u.moraleState !== 'routing' && !u.inVehicle && dist(u, obj) < r) usNear++; }
        for (const v of this.vehicles) { if (v.dead || dist(v, obj) > r) continue; if (v.team === 'RU') ruNear += 2; if (v.team === 'US') usNear += 2; }
        if (ruNear > 0 && usNear === 0) { if (obj.owner !== 'RU') { obj.holdTime += dt; if (obj.holdTime > TACTICS.captureTime) { obj.owner = 'RU'; obj.holdTime = 0; this.addReport('🇷🇺 Точка захвачена РФ', '#d52b1e'); } } }
        else if (usNear > 0 && ruNear === 0) { if (obj.owner !== 'US') { obj.holdTime += dt; if (obj.holdTime > TACTICS.captureTime) { obj.owner = 'US'; obj.holdTime = 0; this.addReport('🇺🇸 Точка захвачена США', '#3c6eb6'); } } }
        else { obj.holdTime = Math.max(0, obj.holdTime - dt); }
    },
    
    endGame(team) {
        this.gameOver = true;
        const el = document.getElementById('game-over'), txt = document.getElementById('result-text');
        if (el) el.classList.remove('hidden');
        if (txt) txt.textContent = team === 'RU' ? '🏆 Победа России!' : '🏆 Победа США!';
        this.addReport(team === 'RU' ? 'Победа России!' : 'Победа США!', team === 'RU' ? '#d52b1e' : '#3c6eb6');
    },
    
    showStatus(msg) { const el = document.getElementById('status-message'); if (!el) return; el.textContent = msg; clearTimeout(this._statusTimer); this._statusTimer = setTimeout(() => { el.textContent = ''; }, 2500); },
    
    addReport(text, color = '#fff') {
        const log = document.getElementById('reports-log'); if (!log) return;
        const el = document.createElement('div'); el.style.color = color;
        const min = Math.floor(this.gameTime / 60).toString().padStart(2, '0'), sec = Math.floor(this.gameTime % 60).toString().padStart(2, '0');
        el.textContent = `[${min}:${sec}] ${text}`; log.appendChild(el);
        if (log.children.length > 6) log.removeChild(log.firstChild);
        setTimeout(() => el.remove(), 6000);
    },
    
    updateUI() {
        const ru = this.squads.find(s => s.team === 'RU'), us = this.squads.find(s => s.team === 'US');
        if (!ru || !us) return;
        const ruEl = document.getElementById('ru-count'), usEl = document.getElementById('us-count');
        if (ruEl) ruEl.textContent = `Живых: ${ru.aliveUnits().length}/${ru.units.length}`;
        if (usEl) usEl.textContent = `Живых: ${us.aliveUnits().length}/${us.units.length}`;
        const statusText = { neutral: 'нейтральна', RU: '🇷🇺 РФ', US: '🇺🇸 США' }[this.objective.owner];
        const osEl = document.getElementById('objective-status'); if (osEl) osEl.textContent = `(${statusText})`;
        const min = Math.floor(this.gameTime / 60).toString().padStart(2, '0'), sec = Math.floor(this.gameTime % 60).toString().padStart(2, '0');
        const timerEl = document.getElementById('mission-timer'); if (timerEl) timerEl.textContent = `${min}:${sec}`;
        this.updateSelectedUI();
    },
    
    updateSelectedUI() {
        const infoPanel = document.getElementById('weapon-info');
        if (!this.selectedUnits.length) { if (infoPanel) infoPanel.classList.remove('visible'); return; }
        const u = this.selectedUnits[0];
        if (u.dead) { if (infoPanel) infoPanel.classList.remove('visible'); return; }
        const w = u.weapon, el = document.getElementById('selected-unit');
        if (el) {
            const aimPct = Math.round(u.aimLevel * 100), moralePct = Math.round(u.morale);
            const moraleIcon = u.moraleState === 'surrendered' ? '🏳️' : u.moraleState === 'routing' ? '🏃' : u.moraleState === 'panicked' ? '😱' : u.moraleState === 'cautious' ? '⚠️' : '';
            const jamIcon = u.radioJamTimer > 0 ? '📵' : '', vehicleIcon = u.inVehicle ? '🚌 В БМП' : '';
            el.innerHTML = `<b>${u.roleName}</b> | HP ${Math.ceil(u.hp)}/${u.maxHp} | ${STANCES[u.stance].name}` +
                (aimPct > 5 ? ` | 🎯 ${aimPct}%` : '') + (u.suppressionLevel > 40 ? ' | ПОДАВЛЕН' : '') +
                (moralePct < 100 ? ` | ${moraleIcon} ${moralePct}%` : '') + (jamIcon ? ` | ${jamIcon} СВЯЗЬ` : '') +
                (vehicleIcon ? ` | ${vehicleIcon}` : '') +
                ` | ⚡ ${Math.round(u.stamina)}%`;
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
    },
    
    loop(now) {
        const dt = Math.min(0.05, (now - this._lastTime) / 1000);
        this._lastTime = now;
        this.update(dt);
        this.draw();
        requestAnimationFrame(t => this.loop(t));
    },
    
    draw() {
        const ctx = this.ctx; if (!ctx) return;
        if (this.mapType === 'forest') ctx.fillStyle = '#1e2e1a'; else if (this.mapType === 'city') ctx.fillStyle = '#2a2a2a'; else ctx.fillStyle = '#2d3a2e';
        ctx.fillRect(0, 0, this.W, this.H);
        
        ctx.save();
        ctx.translate(this.W / 2 + this._screenShake.x, this.H / 2 + this._screenShake.y);
        ctx.scale(Camera.zoom, Camera.zoom);
        ctx.translate(-Camera.x, -Camera.y);
        
        ctx.fillStyle = this.mapType === 'forest' ? '#2a3a24' : this.mapType === 'city' ? '#333' : '#33422f';
        ctx.fillRect(0, 0, WORLD.width, WORLD.height);
        
        ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1 / Camera.zoom;
        ctx.beginPath();
        for (let x = 0; x <= WORLD.width; x += 100) { ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.height); }
        for (let y = 0; y <= WORLD.height; y += 100) { ctx.moveTo(0, y); ctx.lineTo(WORLD.width, y); }
        ctx.stroke();
        ctx.strokeStyle = '#777'; ctx.lineWidth = 3 / Camera.zoom; ctx.strokeRect(0, 0, WORLD.width, WORLD.height);
        
        const obj = this.objective;
        ctx.beginPath(); ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
        ctx.fillStyle = obj.owner === 'RU' ? 'rgba(213,43,30,0.25)' : obj.owner === 'US' ? 'rgba(60,110,182,0.25)' : 'rgba(255,215,0,0.15)'; ctx.fill();
        ctx.strokeStyle = obj.owner === 'RU' ? '#d52b1e' : obj.owner === 'US' ? '#3c6eb6' : '#ffd700'; ctx.lineWidth = 2 / Camera.zoom; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = `bold ${20 / Camera.zoom}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★', obj.x, obj.y);
        
        if (obj.holdTime > 0) {
            const frac = Math.min(1, obj.holdTime / TACTICS.captureTime); ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3 / Camera.zoom;
            ctx.beginPath(); ctx.arc(obj.x, obj.y, obj.radius + 8 / Camera.zoom, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke();
        }
        
        for (let i = 0; i < this.decorations.length; i++) {
            const d = this.decorations[i]; if (d.type === 'bush') { ctx.fillStyle = '#1f401f'; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill(); }
        }
        
        for (let i = 0; i < this.obstacles.length; i++) {
            const obs = this.obstacles[i];
            if (obs.type === 'wall') {
                ctx.fillStyle = '#8B7355'; ctx.fillRect(obs.x - obs.w / 2, obs.y - obs.h / 2, obs.w, obs.h);
                ctx.strokeStyle = '#5a4a35'; ctx.lineWidth = 2 / Camera.zoom; ctx.strokeRect(obs.x - obs.w / 2, obs.y - obs.h / 2, obs.w, obs.h);
            } else if (obs.type === 'house') {
                ctx.fillStyle = '#5a5a5a'; ctx.fillRect(obs.x - obs.w / 2, obs.y - obs.h / 2, obs.w, obs.h);
                ctx.strokeStyle = '#222'; ctx.lineWidth = 2 / Camera.zoom; ctx.strokeRect(obs.x - obs.w / 2, obs.y - obs.h / 2, obs.w, obs.h);
                ctx.fillStyle = '#777'; ctx.fillRect(obs.x - obs.w / 4, obs.y - obs.h / 4, obs.w / 2, obs.h / 2);
            } else if (obs.type === 'tree') {
                ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(obs.x, obs.y, obs.w * 0.4, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#2a5a2a'; ctx.beginPath(); ctx.arc(obs.x, obs.y, obs.w, 0, Math.PI * 2); ctx.fill();
            } else if (obs.type === 'car') {
                ctx.fillStyle = '#4a6a8a'; ctx.fillRect(obs.x - obs.w / 2, obs.y - obs.h / 2, obs.w, obs.h);
                ctx.strokeStyle = '#222'; ctx.lineWidth = 1 / Camera.zoom; ctx.strokeRect(obs.x - obs.w / 2, obs.y - obs.h / 2, obs.w, obs.h);
            }
        }
        
        for (const v of this.vehicles) {
            if (v.dead) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(v.x, v.y, v.radius, 0, Math.PI * 2); ctx.fill(); continue; }
            ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(v.facing);
            ctx.fillStyle = v.team === 'RU' ? '#4a6a3a' : '#3a5a6a'; ctx.fillRect(-v.radius, -v.radius / 1.5, v.radius * 2, v.radius * 1.5);
            ctx.strokeStyle = '#111'; ctx.lineWidth = 2 / Camera.zoom; ctx.strokeRect(-v.radius, -v.radius / 1.5, v.radius * 2, v.radius * 1.5);
            ctx.save(); ctx.rotate(v.turretAngle - v.facing);
            ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(0, 0, v.radius * 0.6, 0, Math.PI * 2); ctx.fill();
            if (!v.turretBroken) { ctx.strokeStyle = '#000'; ctx.lineWidth = 4 / Camera.zoom; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(v.radius * 1.5, 0); ctx.stroke(); }
            ctx.restore();
            if (v.isBurning) {
                ctx.fillStyle = `rgba(255, 100, 0, ${0.5 + Math.sin(performance.now()/100)*0.2})`; ctx.beginPath(); ctx.arc(0, 0, v.radius * 1.2, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(50, 50, 50, 0.7)'; ctx.beginPath(); ctx.arc(0, -v.radius * 1.5, v.radius * 1.5, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        }
        
        const bullets = this.bullets.active;
        for (let i = 0; i < bullets.length; i++) {
            const b = bullets[i]; ctx.strokeStyle = b.color; ctx.lineWidth = (b.isMG ? 2 : 1.5) / Camera.zoom; ctx.beginPath(); ctx.moveTo(b.x, b.y);
            const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy) || 1; ctx.lineTo(b.x + (dx / d) * 40, b.y + (dy / d) * 40); ctx.stroke();
        }
        
        for (let i = 0; i < this.grenades.length; i++) {
            const g = this.grenades[i]; ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(g.x, g.y, 3, 0, Math.PI * 2); ctx.fill();
            if (g.fuse < 0.5) { ctx.fillStyle = `rgba(255, 100, 0, ${Math.random() * 0.5 + 0.5})`; ctx.beginPath(); ctx.arc(g.x, g.y, 5, 0, Math.PI * 2); ctx.fill(); }
        }
        
        for (let i = 0; i < this.smokes.length; i++) {
            const s = this.smokes[i], alpha = Math.min(0.6, s.life / 2); ctx.fillStyle = `rgba(180, 180, 180, ${alpha})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2); ctx.fill();
        }
        
        for (let i = 0; i < this.explosions.length; i++) {
            const e = this.explosions[i], alpha = e.life / 0.5;
            ctx.fillStyle = `rgba(255, 100, 0, ${alpha * 0.6})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.radius * 0.4, 0, Math.PI * 2); ctx.fill();
        }
        
        for (let i = 0; i < this.allUnits.length; i++) { if (!this.allUnits[i].inVehicle) this.drawUnit(this.allUnits[i], ctx); }
        
        for (let i = 0; i < this.damageTexts.length; i++) {
            const t = this.damageTexts[i];
            ctx.fillStyle = t.color; ctx.font = `bold ${14 / Camera.zoom}px sans-serif`; ctx.textAlign = 'center'; ctx.globalAlpha = t.life; ctx.fillText(t.text, t.x, t.y); ctx.globalAlpha = 1;
        }
        
        if (this.mouse.x && !this.isTouch) {
            const wp = Camera.screenToWorld(this.mouse.x, this.mouse.y, this.W, this.H);
            ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1 / Camera.zoom; ctx.beginPath(); ctx.arc(wp.x, wp.y, 8 / Camera.zoom, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
        
        if (typeof Weather !== 'undefined') Weather.draw(this.ctx, Camera, this.W, this.H);
        this.drawMinimap();
    },
    
    drawUnit(u, ctx) {
        if (u.dead) {
            const alpha = Math.max(0.2, 1 - (performance.now() - u.deathTime) / 60000); ctx.fillStyle = `rgba(60, 40, 40, ${alpha})`;
            ctx.save(); ctx.translate(u.x, u.y); ctx.rotate(u.facing + Math.PI / 2); ctx.beginPath(); ctx.ellipse(0, 0, u.radius * 1.8, u.radius * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); return;
        }
        const baseColor = u.team === 'RU' ? '#d52b1e' : '#3c6eb6', isCommander = u.role === 'commander' || u.role === 'squad_leader', isSelected = this.selectedUnits.indexOf(u) !== -1;
        const mod = STANCES[u.stance], vr = u.radius * Math.sqrt(mod.targetSize);
        
        if (u.manualControl) { ctx.setLineDash([4 / Camera.zoom, 4 / Camera.zoom]); ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2 / Camera.zoom; ctx.beginPath(); ctx.arc(u.x, u.y, vr + 6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
        if (u.suppressionLevel > 10) { const a = 0.2 + (u.suppressionLevel / 100) * 0.6; ctx.fillStyle = `rgba(180, 60, 255, ${a})`; ctx.beginPath(); ctx.arc(u.x, u.y, vr + 6, 0, Math.PI * 2); ctx.fill(); }
        if (isSelected) { ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.5 / Camera.zoom; ctx.beginPath(); ctx.arc(u.x, u.y, vr + 4, 0, Math.PI * 2); ctx.stroke(); }
        
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(u.x + 1.5, u.y + 1.5, vr, vr * 0.7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = baseColor;
        
        if (u.stance === 'prone') { ctx.save(); ctx.translate(u.x, u.y); ctx.rotate(u.facing); ctx.beginPath(); ctx.ellipse(0, 0, vr * 1.6, vr * 0.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
        else if (u.stance === 'crouch') { ctx.beginPath(); ctx.arc(u.x, u.y, vr * 0.9, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(u.x, u.y, vr, 0, Math.PI * 2); ctx.fill(); }
        
        if (isCommander) { ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.2 / Camera.zoom; ctx.beginPath(); ctx.arc(u.x, u.y, vr, 0, Math.PI * 2); ctx.stroke(); }
        ctx.strokeStyle = '#fff'; ctx.lineWidth = (u.stance === 'prone' ? 1.5 : 1.2) / Camera.zoom; ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.x + Math.cos(u.facing) * (vr + 3), u.y + Math.sin(u.facing) * (vr + 3)); ctx.stroke();
        
        if (u.muzzleFlash > 0) { ctx.fillStyle = '#ffaa00'; const fx = u.x + Math.cos(u.facing) * (vr + 2), fy = u.y + Math.sin(u.facing) * (vr + 2); ctx.beginPath(); ctx.arc(fx, fy, u.stance === 'prone' ? 3.5 : 2.5, 0, Math.PI * 2); ctx.fill(); }
        
        const hpFrac = u.hp / u.maxHp, bw = 12 / Camera.zoom, bh = 2 / Camera.zoom;
        if (hpFrac < 1) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(u.x - bw / 2, u.y - vr - 6 / Camera.zoom, bw, bh);
            ctx.fillStyle = hpFrac > 0.5 ? '#3c3' : hpFrac > 0.25 ? '#fc3' : '#f33'; ctx.fillRect(u.x - bw / 2, u.y - vr - 6 / Camera.zoom, bw * hpFrac, bh);
        }
        if (u.morale < 100) {
            const mc = u.morale > 70 ? '#3c3' : u.morale > 40 ? '#fc3' : u.morale > 20 ? '#f93' : '#f33', my = u.y - vr - 10 / Camera.zoom;
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(u.x - bw / 2, my, bw, bh); ctx.fillStyle = mc; ctx.fillRect(u.x - bw / 2, my, bw * (u.morale / 100), bh);
        }
        if (u.isReloading) { const prog = 1 - (u.reloadTimer / u.weapon.reloadTime); ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2 / Camera.zoom; ctx.beginPath(); ctx.arc(u.x, u.y, vr + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); ctx.stroke(); }
        if (u.health.bloodLoss > 30) { ctx.fillStyle = '#ff4444'; ctx.font = `bold ${12 / Camera.zoom}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('🩸', u.x, u.y - vr - 38 / Camera.zoom); }
        if (u.radioJamTimer > 0) { ctx.fillStyle = '#ff4444'; ctx.font = `bold ${12 / Camera.zoom}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('📵', u.x, u.y - vr - 18 / Camera.zoom); }
        if (u.moraleState !== 'normal') { const icons = { cautious: '⚠️', panicked: '😱', routing: '🏃', surrendered: '🏳️' }; ctx.font = `bold ${12 / Camera.zoom}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(icons[u.moraleState] || '', u.x, u.y - vr - 28 / Camera.zoom); }
    },
    
    drawMinimap() {
        if (!this.mctx) return;
        const mw = this.minimap.width, mh = this.minimap.height, mctx = this.mctx;
        mctx.fillStyle = '#1a2418'; mctx.fillRect(0, 0, mw, mh);
        const sx = mw / WORLD.width, sy = mh / WORLD.height;
        for (let i = 0; i < this.obstacles.length; i++) {
            const obs = this.obstacles[i]; mctx.fillStyle = obs.type === 'house' ? '#555' : obs.type === 'tree' ? '#2a4a2a' : obs.type === 'car' ? '#446' : '#7a6545';
            mctx.fillRect((obs.x - obs.w / 2) * sx, (obs.y - obs.h / 2) * sy, obs.w * sx, obs.h * sy);
        }
        const obj = this.objective;
        mctx.beginPath(); mctx.arc(obj.x * sx, obj.y * sy, 8, 0, Math.PI * 2);
        mctx.fillStyle = obj.owner === 'RU' ? 'rgba(213,43,30,0.5)' : obj.owner === 'US' ? 'rgba(60,110,182,0.5)' : 'rgba(255,215,0,0.3)'; mctx.fill();
        mctx.strokeStyle = obj.owner === 'RU' ? '#d52b1e' : obj.owner === 'US' ? '#3c6eb6' : '#ffd700'; mctx.lineWidth = 1.5; mctx.stroke();
        for (let i = 0; i < this.vehicles.length; i++) { const v = this.vehicles[i]; if (v.dead) continue; mctx.fillStyle = v.team === 'RU' ? '#a33' : '#36a'; mctx.fillRect(v.x * sx - 3, v.y * sy - 3, 6, 6); }
        for (let i = 0; i < this.allUnits.length; i++) { const u = this.allUnits[i]; if (u.dead) continue; mctx.fillStyle = u.team === 'RU' ? '#d52b1e' : '#3c6eb6'; mctx.beginPath(); mctx.arc(u.x * sx, u.y * sy, 2, 0, Math.PI * 2); mctx.fill(); }
        const halfW = (this.W / 2) / Camera.zoom, halfH = (this.H / 2) / Camera.zoom;
        mctx.strokeStyle = 'rgba(255,255,255,0.8)'; mctx.lineWidth = 1; mctx.strokeRect((Camera.x - halfW) * sx, (Camera.y - halfH) * sy, halfW * 2 * sx, halfH * 2 * sy);
    },
    
    screenToWorld(sx, sy) { return Camera.screenToWorld(sx, sy, this.W, this.H); },
    worldToScreen(wx, wy) { return Camera.worldToScreen(wx, wy, this.W, this.H); },
    zoomAt(sx, sy, factor) { Camera.zoomAt(sx, sy, factor, this.W, this.H); },
    
    setupInput() {
        const c = this.canvas;
        c.addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
        c.addEventListener('mousedown', e => {
            if (this.gameOver) return;
            const wp = this.screenToWorld(e.clientX, e.clientY);
            if (e.button === 0) this.handleLeftClick(wp.x, wp.y); else if (e.button === 2) this.executeOrder(wp.x, wp.y);
        });
        c.addEventListener('contextmenu', e => e.preventDefault());
        c.addEventListener('wheel', e => { e.preventDefault(); this.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
        
        document.addEventListener('keydown', e => {
            this.keys[e.key.toLowerCase()] = true;
            if (e.key === 'Escape') { this.selectedUnits = [this.squads[0].leader]; this.updateSelectedUI(); }
            if (e.key === '1') this.setStance('stand'); if (e.key === '2') this.setStance('crouch'); if (e.key === '3') this.setStance('prone');
            if (e.key.toLowerCase() === 'r') {
                this.selectedUnits.forEach(u => { if (u.dead || u.isReloading || u.inVehicle) return; if (u.ammo < u.weapon.maxAmmo) { u.isReloading = true; u.reloadTimer = u.weapon.reloadTime; u.aimTimer = 0; } });
                this.showStatus('Перезарядка'); if (typeof Audio !== 'undefined') Audio.reload();
            }
        });
        document.addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
    },
    
    handleLeftClick(wx, wy) {
        for (const u of this.allUnits) {
            if (u.dead || u.team !== 'RU' || u.inVehicle) continue;
            if (Math.hypot(u.x - wx, u.y - wy) < u.radius + 6 / Camera.zoom) { this.selectedUnits = [u]; this.updateSelectedUI(); return; }
        }
        for (const v of this.vehicles) {
            if (v.dead || v.team !== 'RU') continue;
            if (Math.hypot(v.x - wx, v.y - wy) < v.radius + 6 / Camera.zoom) { this.showStatus('Выбрана техника'); return; }
        }
        for (const u of this.allUnits) {
            if (u.dead || u.team !== 'US' || u.inVehicle) continue;
            if (Math.hypot(u.x - wx, u.y - wy) < u.radius + 8 / Camera.zoom) {
                this.selectedUnits.forEach(s => { s.moveTarget = { x: u.x, y: u.y }; s._hasActiveOrder = true; });
                this.showStatus(`Атака: ${u.roleName}`); return;
            }
        }
        this.executeOrder(wx, wy);
    },
    
    executeOrder(wx, wy) {
        if (this.globalAIMode) { this.showStatus('Сначала перехватите управление'); return; }
        const controllable = this.selectedUnits.filter(u => u.manualControl && !u.dead && !u.inVehicle);
        if (controllable.length === 0) { this.showStatus('Нет солдат под управлением'); return; }
        
        const commander = this.squads.flatMap(s => s.units).find(u => (u.role === 'commander' || u.role === 'squad_leader') && !u.dead && u.manualControl && !u.inVehicle);
        
        if (this.orderMode === 'move') {
            if (commander) { commander.pendingOrder = { type: 'move', x: wx, y: wy, time: TACTICS.radio.orderDelay }; this.showStatus('Приказ передан (2 с)...'); }
            else { controllable.forEach(u => { u.moveTarget = { x: wx, y: wy }; u._hasActiveOrder = true; }); }
        } else if (this.orderMode === 'attack') {
            controllable.forEach(u => { u.moveTarget = { x: wx, y: wy }; u._hasActiveOrder = true; }); this.showStatus('Атака');
        } else if (this.orderMode === 'hold') {
            controllable.forEach(u => { u.moveTarget = null; u.holding = true; u.formationSlot = null; }); this.showStatus('Держать позицию');
        } else if (this.orderMode === 'follow') {
            controllable.forEach(u => { u.followTarget = commander; }); this.showStatus('Следовать за командиром');
        }
    },
    
    setOrderMode(mode) {
        this.orderMode = mode;
        document.querySelectorAll('#orders button').forEach(b => b.classList.remove('active'));
        const map = { move: 'btn-move', attack: 'btn-attack', hold: 'btn-hold', follow: 'btn-follow' };
        const btn = document.getElementById(map[mode]); if (btn) btn.classList.add('active');
    },
    
    setStance(stance) {
        this.selectedUnits.forEach(u => { if (u.dead || u.inVehicle) return; u.stanceLocked = true; u.setStance(stance); });
        this.showStatus(STANCES[stance].name);
    },
    
    toggleAIMode() {
        const btn = document.getElementById('btn-ai-mode');
        if (this.globalAIMode) {
            const alive = this.selectedUnits.filter(u => !u.dead);
            if (alive.length === 0) { this.showStatus('Выберите живого'); return; }
            const isCmd = alive.some(u => u.role === 'commander');
            if (isCmd) { this.squads.find(s => s.team === 'RU').units.forEach(u => { if (!u.dead) u.manualControl = true; }); this.showStatus('Ручное управление отделением'); }
            else { alive.forEach(u => u.manualControl = true); this.showStatus(`Ручное: ${alive[0].roleName}`); }
            this.globalAIMode = false; if (btn) { btn.textContent = 'ИИ: ВЫКЛ'; btn.style.background = '#6a3a3a'; }
        } else {
            this.squads.find(s => s.team === 'RU').units.forEach(u => { u.manualControl = false; u.moveTarget = null; u.formationSlot = null; u.holding = false; u._hasActiveOrder = false; });
            this.globalAIMode = true; if (btn) { btn.textContent = 'ИИ: ВКЛ'; btn.style.background = '#4a3a6a'; } this.showStatus('Управление ИИ');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    try {
        const canvas = document.getElementById('game'), minimap = document.getElementById('minimap');
        if (!canvas || !minimap) { console.error('Canvas не найден'); return; }
        GAME.init(canvas, minimap);
        if (typeof Audio !== 'undefined') Audio.init();
        if (typeof Weather !== 'undefined') Weather.init();
        console.log('✅ GAME инициализирован');
        
        const maps = [{ id: 'map-open', type: 'open' }, { id: 'map-forest', type: 'forest' }, { id: 'map-city', type: 'city' }];
        let mapChosen = false;
        maps.forEach(({ id, type }) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.addEventListener('click', e => {
                e.preventDefault(); e.stopPropagation(); if (mapChosen) return;
                mapChosen = true; const sel = document.getElementById('map-select'); if (sel) sel.style.display = 'none';
                GAME.start(type);
            });
        });
        
        const aiBtn = document.getElementById('btn-ai-mode'); if (aiBtn) aiBtn.addEventListener('click', () => GAME.toggleAIMode());
        const orderBtns = { 'btn-move': 'move', 'btn-attack': 'attack', 'btn-hold': 'hold', 'btn-follow': 'follow' };
        Object.entries(orderBtns).forEach(([id, mode]) => { const btn = document.getElementById(id); if (btn) btn.addEventListener('click', () => GAME.setOrderMode(mode)); });
        const stanceBtns = { 'btn-stand': 'stand', 'btn-crouch': 'crouch', 'btn-prone': 'prone' };
        Object.entries(stanceBtns).forEach(([id, stance]) => { const btn = document.getElementById(id); if (btn) btn.addEventListener('click', () => GAME.setStance(stance)); });
        
        const reloadBtn = document.getElementById('btn-reload');
        if (reloadBtn) reloadBtn.addEventListener('click', () => {
            GAME.selectedUnits.forEach(u => { if (u.dead || u.isReloading || u.inVehicle) return; if (u.ammo < u.weapon.maxAmmo) { u.isReloading = true; u.reloadTimer = u.weapon.reloadTime; u.aimTimer = 0; } });
            GAME.showStatus('Перезарядка'); if (typeof Audio !== 'undefined') Audio.reload();
        });
        
        const fragBtn = document.getElementById('btn-frag');
        if (fragBtn) fragBtn.addEventListener('click', () => {
            GAME.selectedUnits.forEach(u => {
                if (u.dead || u.health.dead || u.inVehicle) return; if (u.grenades.frag <= 0) { GAME.showStatus('Нет гранат'); return; }
                if (u.grenadeCooldown > 0) { GAME.showStatus('Перезарядка гранаты'); return; } if (!u.target) { GAME.showStatus('Нет цели'); return; }
                const shot = u.throwGrenade(u.target, 'frag'); if (shot) { GAME.handleShot(shot); GAME.showStatus(`Граната: ${u.grenades.frag} осталось`); }
            });
        });
        
        const smokeBtn = document.getElementById('btn-smoke');
        if (smokeBtn) smokeBtn.addEventListener('click', () => {
            GAME.selectedUnits.forEach(u => {
                if (u.dead || u.health.dead || u.inVehicle) return; if (u.grenades.smoke <= 0) { GAME.showStatus('Нет дыма'); return; }
                if (u.smokeCooldown > 0) { GAME.showStatus('Перезарядка дыма'); return; }
                const smokeTarget = { x: u.x + Math.cos(u.facing) * 15, y: u.y + Math.sin(u.facing) * 15 };
                const shot = u.throwGrenade(smokeTarget, 'smoke'); if (shot) { GAME.handleShot(shot); u.smokeCooldown = 15; GAME.showStatus(`Дым: ${u.grenades.smoke} осталось`); }
            });
        });
        
        const camUp = document.getElementById('cam-up'), camDown = document.getElementById('cam-down'), camIn = document.getElementById('cam-zoom-in'), camOut = document.getElementById('cam-zoom-out');
        if (camUp) { camUp.addEventListener('pointerdown', () => GAME.keys['w'] = true); camUp.addEventListener('pointerup', () => GAME.keys['w'] = false); camUp.addEventListener('pointerleave', () => GAME.keys['w'] = false); }
        if (camDown) { camDown.addEventListener('pointerdown', () => GAME.keys['s'] = true); camDown.addEventListener('pointerup', () => GAME.keys['s'] = false); camDown.addEventListener('pointerleave', () => GAME.keys['s'] = false); }
        if (camIn) camIn.addEventListener('click', () => GAME.zoomAt(GAME.W / 2, GAME.H / 2, 1.25));
        if (camOut) camOut.addEventListener('click', () => GAME.zoomAt(GAME.W / 2, GAME.H / 2, 1 / 1.25));
        
        document.querySelectorAll('.radial-btn').forEach(btn => {
            btn.addEventListener('click', e => { e.stopPropagation(); const menu = document.getElementById('radial-menu'); if (menu) menu.classList.remove('visible'); GAME.setOrderMode(btn.dataset.order); });
        });
        
        if (minimap) {
            let drag = false;
            const setFromMinimap = (e) => { const r = minimap.getBoundingClientRect(); Camera.x = ((e.clientX - r.left) / r.width) * WORLD.width; Camera.y = ((e.clientY - r.top) / r.height) * WORLD.height; Camera.clamp(GAME.W, GAME.H); };
            minimap.addEventListener('mousedown', e => { drag = true; setFromMinimap(e); });
            minimap.addEventListener('mousemove', e => { if (drag) setFromMinimap(e); });
            window.addEventListener('mouseup', () => { drag = false; });
            minimap.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') { drag = true; minimap.setPointerCapture(e.pointerId); setFromMinimap(e); } });
            minimap.addEventListener('pointermove', e => { if (e.pointerType === 'touch' && drag) setFromMinimap(e); });
            minimap.addEventListener('pointerup', () => { drag = false; });
        }
        GAME.setOrderMode('move'); console.log('✅ Bootstrap завершён');
    } catch (e) { console.error('❌ Ошибка bootstrap:', e); alert('Ошибка инициализации: ' + e.message); }
});
